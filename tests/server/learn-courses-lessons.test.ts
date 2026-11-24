import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { fakeProvider, type GenerateCall } from '../fixtures/fake-provider.ts';
import {
  courseApp,
  createCourse,
  LESSON,
  MISSING_CHECKS,
  NOW,
  OUTLINE,
} from '../fixtures/course-app.ts';

let dir: string;
beforeEach(async () => {
  dir = await mkdtemp(path.join(os.tmpdir(), 'sraww-course-lessons-'));
});
afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe('GET /api/learn/courses/:id', () => {
  it('lists the lessons already built for the course topics', async () => {
    const app = courseApp(dir, fakeProvider({ outline: OUTLINE, lesson: LESSON }));
    const course = await createCourse(app);
    const firstTopicId = course.modules[0].topics[0].id;
    const opened = await request(app).post(
      `/api/learn/courses/${course.id}/topics/${firstTopicId}/lesson`,
    );

    const res = await request(app).get(`/api/learn/courses/${course.id}`);

    expect(res.status).toBe(200);
    expect(res.body.course.id).toBe(course.id);
    expect(res.body.builtLessons).toEqual({ [firstTopicId]: opened.body.lesson.id });
  });
});

describe('POST /api/learn/courses/:id/topics/:topicId/lesson', () => {
  it('builds a topic lesson once, then returns the same lesson', async () => {
    const calls: GenerateCall[] = [];
    const app = courseApp(dir, fakeProvider({ outline: OUTLINE, lesson: LESSON }, calls));
    const course = await createCourse(app);
    const topicId = course.modules[0].topics[0].id;
    const url = `/api/learn/courses/${course.id}/topics/${topicId}/lesson`;

    const first = await request(app).post(url);
    const second = await request(app).post(url);

    expect(first.status).toBe(201);
    expect(first.body).toMatchObject({ skippedSources: 0 });
    expect(first.body.lesson).toMatchObject({
      title: 'What a cache is',
      topic: 'HTTP caching: What a cache is',
      courseId: course.id,
      topicId,
      createdAt: NOW,
      provider: 'claude',
    });
    expect(second.status).toBe(200);
    expect(second.body.lesson.id).toBe(first.body.lesson.id);
    expect(calls).toHaveLength(2);
  });

  it('returns 404 for an unknown course or an unknown topic', async () => {
    const app = courseApp(dir, fakeProvider({ outline: OUTLINE, lesson: LESSON }));
    const course = await createCourse(app);

    const unknownCourse = await request(app).post(
      `/api/learn/courses/no-such-course/topics/${course.modules[0].topics[0].id}/lesson`,
    );
    const unknownTopic = await request(app).post(
      `/api/learn/courses/${course.id}/topics/no-such-topic/lesson`,
    );

    expect(unknownCourse.status).toBe(404);
    expect(unknownTopic.status).toBe(404);
  });

  it('builds nothing when the lesson sources cannot be checked', async () => {
    const app = courseApp(dir, fakeProvider({ outline: OUTLINE, lesson: LESSON }), MISSING_CHECKS);
    const course = await createCourse(app);
    const topicId = course.modules[0].topics[0].id;

    const res = await request(app).post(`/api/learn/courses/${course.id}/topics/${topicId}/lesson`);
    const after = await request(app).get(`/api/learn/courses/${course.id}`);

    expect(res.status).toBe(502);
    expect(res.body.code).toBe('INVALID_OUTPUT');
    expect(after.body.builtLessons).toEqual({});
  });
});
