import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  LEARN_LIMITS,
  moduleQuizReplySchema,
  moduleQuizSchema,
  type Course,
  type ModuleQuiz,
} from '../../src/shared/learn.ts';
import { createCourseQuizStore } from '../../src/server/storage/course-quiz-store.ts';
import { createCourseStore } from '../../src/server/storage/course-store.ts';

let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(path.join(os.tmpdir(), 'sraww-course-quizzes-'));
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

const course: Course = {
  id: 'course-1',
  title: 'HTTP caching',
  prompt: 'HTTP caching',
  createdAt: '2026-11-24T10:00:00.000Z',
  modules: [
    {
      id: 'module-1',
      title: 'Basics',
      topics: [{ id: 'topic-1', title: 'Cache', summary: 'A cache keeps a copy.' }],
    },
  ],
  progress: { topicId: 'topic-1' },
};

const quiz: ModuleQuiz = {
  courseId: course.id,
  moduleId: 'module-1',
  sourceTopicIds: ['topic-1'],
  createdAt: '2026-11-24T10:10:00.000Z',
  questions: [
    {
      id: 'question-1',
      prompt: 'What does a cache keep?',
      sampleAnswer: 'A cache keeps a copy of a response.',
      explanation: 'A copy can be reused.',
    },
    {
      id: 'question-2',
      prompt: 'What does max-age control?',
      sampleAnswer: 'It controls how long a cached copy stays fresh.',
      explanation: 'Freshness controls reuse.',
    },
  ],
  attempts: 0,
  bestSelfRated: 0,
  lastSelfRated: 0,
  attemptIds: [],
};

describe('module quiz schema', () => {
  it('accepts every text and count cap, then rejects values beyond each cap', () => {
    const atTextCaps = {
      prompt: 'p'.repeat(LEARN_LIMITS.maxQuizPrompt),
      sampleAnswer: 'a'.repeat(LEARN_LIMITS.maxQuizSampleAnswer),
      explanation: 'e'.repeat(LEARN_LIMITS.maxQuizExplanation),
    };
    const replyAtCaps = {
      questions: Array.from({ length: LEARN_LIMITS.maxQuizQuestions }, () => atTextCaps),
    };
    const storedAtCaps: ModuleQuiz = {
      ...quiz,
      sourceTopicIds: Array.from(
        { length: LEARN_LIMITS.maxModuleTopics },
        (_, index) => `topic-${index}`,
      ),
      questions: replyAtCaps.questions.map((question, index) => ({
        ...question,
        id: `question-${index}`,
      })),
      attempts: LEARN_LIMITS.maxQuizAttemptIds,
      attemptIds: Array.from(
        { length: LEARN_LIMITS.maxQuizAttemptIds },
        (_, index) => `attempt-${index}`,
      ),
    };

    expect(moduleQuizReplySchema.parse(replyAtCaps)).toEqual(replyAtCaps);
    expect(moduleQuizSchema.parse(storedAtCaps)).toEqual(storedAtCaps);
    expect(
      moduleQuizSchema.parse({
        ...storedAtCaps,
        attempts: LEARN_LIMITS.maxQuizAttemptIds + 1,
      }).attemptIds,
    ).toHaveLength(LEARN_LIMITS.maxQuizAttemptIds);
    expect(
      moduleQuizReplySchema.safeParse({
        questions: [...replyAtCaps.questions, atTextCaps],
      }).success,
    ).toBe(false);
    expect(
      moduleQuizSchema.safeParse({
        ...storedAtCaps,
        sourceTopicIds: [...storedAtCaps.sourceTopicIds, 'topic-over-limit'],
      }).success,
    ).toBe(false);
    expect(
      moduleQuizSchema.safeParse({
        ...storedAtCaps,
        attempts: LEARN_LIMITS.maxQuizAttemptIds + 1,
        attemptIds: [...storedAtCaps.attemptIds, 'attempt-over-limit'],
      }).success,
    ).toBe(false);

    for (const [field, limit] of [
      ['prompt', LEARN_LIMITS.maxQuizPrompt],
      ['sampleAnswer', LEARN_LIMITS.maxQuizSampleAnswer],
      ['explanation', LEARN_LIMITS.maxQuizExplanation],
    ] as const) {
      const beyondCap = { ...atTextCaps, [field]: 'x'.repeat(limit + 1) };
      expect(moduleQuizReplySchema.safeParse({ questions: [beyondCap] }).success).toBe(false);
      expect(
        moduleQuizSchema.safeParse({
          ...quiz,
          questions: [{ id: 'question-1', ...beyondCap }],
        }).success,
      ).toBe(false);
    }
  });

  it('rejects self-ratings outside the question range and impossible aggregate history', () => {
    expect(moduleQuizSchema.safeParse({ ...quiz, bestSelfRated: 3 }).success).toBe(false);
    expect(moduleQuizSchema.safeParse({ ...quiz, lastSelfRated: -1 }).success).toBe(false);
    expect(
      moduleQuizSchema.safeParse({
        ...quiz,
        attempts: 1,
        attemptIds: ['attempt-1'],
        bestSelfRated: 0,
        lastSelfRated: 1,
      }).success,
    ).toBe(false);
    expect(
      moduleQuizSchema.safeParse({
        ...quiz,
        bestSelfRated: 1,
        lastSelfRated: 1,
      }).success,
    ).toBe(false);
    expect(moduleQuizSchema.safeParse({ ...quiz, attempts: 1 }).success).toBe(false);
    expect(
      moduleQuizSchema.safeParse({
        ...quiz,
        attempts: 2,
        attemptIds: ['attempt-1', 'attempt-1'],
      }).success,
    ).toBe(false);
    expect(moduleQuizSchema.parse(quiz)).toEqual(quiz);
  });
});

describe('CourseQuizStore', () => {
  it('keeps quiz sidecars separate from course progress', async () => {
    const courses = createCourseStore(dir);
    const quizzes = createCourseQuizStore(dir);
    await courses.save(course);
    await quizzes.save(quiz);

    const savedPath = path.join(dir, 'learn-quizzes', course.id, 'module-1.json');
    expect(JSON.parse(await readFile(savedPath, 'utf8'))).toEqual(quiz);
    expect(await quizzes.read(course.id, 'module-1')).toEqual(quiz);
    expect(await courses.read(course.id)).toEqual(course);
  });

  it('serializes concurrent result updates without losing attempts', async () => {
    const quizzes = createCourseQuizStore(dir);
    await quizzes.save(quiz);

    await Promise.all(
      Array.from({ length: 30 }, (_, index) =>
        quizzes.recordResult(course.id, 'module-1', `attempt-${index}`, 1),
      ),
    );

    const updated = await quizzes.read(course.id, 'module-1');
    expect(updated).toMatchObject({
      attempts: 30,
      bestSelfRated: 1,
      lastSelfRated: 1,
    });
    const lastAttemptId = updated?.attemptIds.at(-1);
    expect(lastAttemptId).toMatch(/^attempt-\d+$/);
    const retried = await quizzes.recordResult(course.id, 'module-1', lastAttemptId!, 0);
    expect(retried).toMatchObject({ attempts: 30, lastSelfRated: 1 });
    await expect(
      quizzes.recordResult(course.id, 'module-1', 'attempt-out-of-range', 3),
    ).rejects.toThrow(RangeError);
  });

  it('deduplicates a delayed retry after a newer attempt has been saved', async () => {
    const quizzes = createCourseQuizStore(dir);
    await quizzes.save(quiz);

    await quizzes.recordResult(course.id, 'module-1', 'attempt-a', 1);
    await quizzes.recordResult(course.id, 'module-1', 'attempt-b', 2);
    const replayed = await quizzes.recordResult(course.id, 'module-1', 'attempt-a', 0);

    expect(replayed).toMatchObject({
      attempts: 2,
      bestSelfRated: 2,
      lastSelfRated: 2,
      attemptIds: ['attempt-a', 'attempt-b'],
    });
  });

  it('keeps a 256-id retry window and treats an expired id as a new attempt', async () => {
    const quizzes = createCourseQuizStore(dir);
    await quizzes.save(quiz);
    for (let index = 0; index <= LEARN_LIMITS.maxQuizAttemptIds; index += 1) {
      await quizzes.recordResult(course.id, 'module-1', `attempt-${index}`, 1);
    }

    const beforeReplay = await quizzes.read(course.id, 'module-1');
    expect(beforeReplay?.attempts).toBe(LEARN_LIMITS.maxQuizAttemptIds + 1);
    expect(beforeReplay?.attemptIds).toHaveLength(LEARN_LIMITS.maxQuizAttemptIds);
    expect(beforeReplay?.attemptIds[0]).toBe('attempt-1');
    const replayed = await quizzes.recordResult(course.id, 'module-1', 'attempt-0', 0);

    expect(replayed).toMatchObject({
      attempts: LEARN_LIMITS.maxQuizAttemptIds + 2,
      bestSelfRated: 1,
      lastSelfRated: 0,
    });
    expect(replayed?.attemptIds).toHaveLength(LEARN_LIMITS.maxQuizAttemptIds);
    expect(replayed?.attemptIds.at(-1)).toBe('attempt-0');
  });

  it('treats malformed sidecars and unsafe ids as missing', async () => {
    const quizzes = createCourseQuizStore(dir);
    const folder = path.join(dir, 'learn-quizzes', course.id);
    await mkdir(folder, { recursive: true });
    const sidecar = path.join(folder, 'module-1.json');
    await writeFile(sidecar, '{invalid json', 'utf8');
    expect(await quizzes.read(course.id, 'module-1')).toBeNull();
    await writeFile(
      sidecar,
      JSON.stringify({
        ...quiz,
        attempts: 1,
        bestSelfRated: 0,
        lastSelfRated: 1,
        attemptIds: ['attempt-1'],
      }),
      'utf8',
    );
    expect(await quizzes.read(course.id, 'module-1')).toBeNull();
    expect(await quizzes.read('../outside', 'module-1')).toBeNull();
  });
});
