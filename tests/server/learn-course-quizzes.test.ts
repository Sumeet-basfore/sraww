import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { z } from 'zod';
import { AiError } from '../../src/server/ai/ai-error.ts';
import type { AiProvider, GenerateOptions } from '../../src/server/ai/provider.ts';
import type { Course } from '../../src/shared/learn.ts';
import { moduleQuizReplySchema } from '../../src/shared/learn.ts';
import { fakeProvider, type GenerateCall } from '../fixtures/fake-provider.ts';
import { courseApp, createCourse, LESSON, OUTLINE } from '../fixtures/course-app.ts';
import { createCourseQuizStore } from '../../src/server/storage/course-quiz-store.ts';
import { LEARN_LIMITS } from '../../src/shared/learn.ts';

let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(path.join(os.tmpdir(), 'sraww-course-quiz-routes-'));
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

const QUIZ = {
  questions: [
    {
      prompt: 'What does a cache keep?',
      sampleAnswer: 'A cache keeps a copy of a response.',
      explanation: 'The copy can serve a later request.',
    },
    {
      prompt: 'What does max-age control?',
      sampleAnswer: 'It controls how long a copy stays fresh.',
      explanation: 'Freshness tells the cache when to reuse a copy.',
    },
  ],
};

async function buildModuleLessons(app: ReturnType<typeof courseApp>, course: Course) {
  const module = course.modules[0]!;
  for (const topic of module.topics) {
    const res = await request(app).post(
      `/api/learn/courses/${course.id}/topics/${topic.id}/lesson`,
    );
    expect(res.status).toBe(201);
  }
  return module;
}

describe('module quiz routes', () => {
  it('returns not found for an unknown course or module', async () => {
    const app = courseApp(dir, fakeProvider({ outline: OUTLINE, lesson: LESSON, quiz: QUIZ }));
    const course = await createCourse(app);

    expect(
      (await request(app).post('/api/learn/courses/missing/modules/module-1/quiz')).status,
    ).toBe(404);
    expect(
      (await request(app).post(`/api/learn/courses/${course.id}/modules/missing/quiz`)).status,
    ).toBe(404);
  });

  it('requires every module lesson before generation', async () => {
    const calls: GenerateCall[] = [];
    const app = courseApp(
      dir,
      fakeProvider({ outline: OUTLINE, lesson: LESSON, quiz: QUIZ }, calls),
    );
    const course = await createCourse(app);
    const module = course.modules[0]!;

    const res = await request(app).post(
      `/api/learn/courses/${course.id}/modules/${module.id}/quiz`,
    );

    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/Build every lesson/);
    expect(calls.filter((call) => call.options?.disableTools === true)).toHaveLength(0);
  });

  it('shares concurrent generation and reuses the validated saved quiz', async () => {
    const calls: GenerateCall[] = [];
    const app = courseApp(
      dir,
      fakeProvider({ outline: OUTLINE, lesson: LESSON, quiz: QUIZ, quizDelayMs: 25 }, calls),
    );
    const course = await createCourse(app);
    const module = await buildModuleLessons(app, course);
    const endpoint = `/api/learn/courses/${course.id}/modules/${module.id}/quiz`;
    const [first, second] = await Promise.all([
      request(app).post(endpoint),
      request(app).post(endpoint),
    ]);

    expect(first.status).toBe(200);
    expect(second.body.quiz).toEqual(first.body.quiz);
    expect(first.body.quiz).toMatchObject({
      courseId: course.id,
      moduleId: module.id,
      sourceTopicIds: module.topics.map((topic) => topic.id),
      createdAt: '2026-11-24T10:00:00.000Z',
      attempts: 0,
      bestSelfRated: 0,
      lastSelfRated: 0,
    });
    expect(first.body.quiz.questions).toHaveLength(2);
    expect(first.body.quiz.questions[0].id).toMatch(/^[a-f0-9-]{36}$/);

    const quizCalls = calls.filter((call) => call.options?.disableTools === true);
    expect(quizCalls).toHaveLength(1);
    const quizCall = quizCalls[0]!;
    expect(quizCall.options).toEqual({ disableTools: true, webSearch: false });
    expect(quizCall.prompt).toContain(course.title);
    expect(quizCall.prompt).toContain(module.title);
    expect(quizCall.prompt).toContain(LESSON.explanation);
    expect(quizCall.prompt).toContain('cache');
    expect((await request(app).post(endpoint)).body.quiz).toEqual(first.body.quiz);
    expect(calls.filter((call) => call.options?.disableTools === true)).toHaveLength(1);
  });

  it('saves nothing when generated quiz output is invalid, then allows a retry', async () => {
    const calls: GenerateCall[] = [];
    const invalidQuiz = {
      questions: Array.from(
        { length: LEARN_LIMITS.maxQuizQuestions + 1 },
        () => QUIZ.questions[0]!,
      ),
    };
    const baseProvider = fakeProvider({ outline: OUTLINE, lesson: LESSON, quiz: QUIZ }, calls);
    let quizAttempts = 0;
    const provider: AiProvider = {
      ...baseProvider,
      generate: async <T>(
        prompt: string,
        schema: z.ZodType<T>,
        options?: GenerateOptions,
      ): Promise<T> => {
        if ((schema as unknown) === moduleQuizReplySchema) {
          calls.push({ prompt, options });
          const candidate = quizAttempts++ === 0 ? invalidQuiz : QUIZ;
          const checked = schema.safeParse(candidate);
          if (!checked.success) {
            throw new AiError('INVALID_OUTPUT', 'The CLI returned an invalid quiz.');
          }
          return checked.data;
        }
        return baseProvider.generate(prompt, schema, options);
      },
    };
    const app = courseApp(dir, provider);
    const course = await createCourse(app);
    const module = await buildModuleLessons(app, course);
    const endpoint = `/api/learn/courses/${course.id}/modules/${module.id}/quiz`;
    const quizzes = createCourseQuizStore(dir);

    expect((await request(app).post(endpoint)).status).toBe(502);
    expect(await quizzes.read(course.id, module.id)).toBeNull();
    const retried = await request(app).post(endpoint);

    expect(retried.status).toBe(200);
    expect(retried.body.quiz.questions).toHaveLength(2);
    expect(calls.filter((call) => call.options?.disableTools === true)).toHaveLength(2);
  });

  it('accepts only bounded aggregate self-ratings and reports them on course reload', async () => {
    const calls: GenerateCall[] = [];
    const app = courseApp(
      dir,
      fakeProvider({ outline: OUTLINE, lesson: LESSON, quiz: QUIZ }, calls),
    );
    const course = await createCourse(app);
    const module = await buildModuleLessons(app, course);
    const endpoint = `/api/learn/courses/${course.id}/modules/${module.id}/quiz`;
    await request(app).post(endpoint);

    expect(
      (
        await request(app)
          .put(`${endpoint}/results`)
          .send({ attemptId: 'attempt-extra', selfRatedCount: 1, answer: 'private answer' })
      ).status,
    ).toBe(400);
    expect(
      (
        await request(app)
          .put(`${endpoint}/results`)
          .send({ attemptId: 'attempt-out-of-range', selfRatedCount: 3 })
      ).status,
    ).toBe(400);

    const saved = await request(app)
      .put(`${endpoint}/results`)
      .send({ attemptId: 'attempt-1', selfRatedCount: 1 });
    const second = await request(app)
      .put(`${endpoint}/results`)
      .send({ attemptId: 'attempt-2', selfRatedCount: 2 });
    const delayedDuplicate = await request(app)
      .put(`${endpoint}/results`)
      .send({ attemptId: 'attempt-1', selfRatedCount: 0 });
    const courseReload = await request(app).get(`/api/learn/courses/${course.id}`);

    expect(saved.status).toBe(200);
    expect(saved.body.quiz).toMatchObject({ attempts: 1, bestSelfRated: 1, lastSelfRated: 1 });
    expect(second.body.quiz).toMatchObject({ attempts: 2, bestSelfRated: 2, lastSelfRated: 2 });
    expect(delayedDuplicate.body.quiz).toMatchObject({
      attempts: 2,
      bestSelfRated: 2,
      lastSelfRated: 2,
    });
    expect(delayedDuplicate.body.quiz).not.toHaveProperty('attemptIds');
    expect(courseReload.body.quizResults[module.id]).toEqual({
      attempts: 2,
      bestSelfRated: 2,
      lastSelfRated: 2,
      questionCount: 2,
    });
    expect(JSON.stringify(saved.body)).not.toContain('private answer');
    expect(courseReload.body.course.progress.topicId).toBeNull();
  });
});
