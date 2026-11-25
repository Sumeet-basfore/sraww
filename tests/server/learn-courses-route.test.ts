import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AiError } from '../../src/server/ai/ai-error.ts';
import type { AiProvider } from '../../src/server/ai/provider.ts';
import { fakeProvider } from '../fixtures/fake-provider.ts';
import { courseApp, createCourse, NOW, OUTLINE } from '../fixtures/course-app.ts';

let dir: string;
beforeEach(async () => {
  dir = await mkdtemp(path.join(os.tmpdir(), 'sraww-course-routes-'));
});
afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

function failingProvider(error: AiError): AiProvider {
  return {
    ...fakeProvider({}),
    generate: async () => {
      throw error;
    },
  };
}

function oversizedOutline() {
  const topics = (count: number) =>
    Array.from({ length: count }, (_, i) => ({
      title: `Topic ${i + 1}`,
      summary: 'One sentence.',
    }));
  return {
    title: 'Too big',
    modules: [
      { title: 'A', topics: topics(12) },
      { title: 'B', topics: topics(12) },
      { title: 'C', topics: topics(1) },
    ],
  };
}

describe('POST /api/learn/courses', () => {
  it('returns 201 with a course whose ids the server assigned', async () => {
    const app = courseApp(dir, fakeProvider({ outline: OUTLINE }));

    const res = await request(app).post('/api/learn/courses').send({ topic: '  HTTP caching  ' });

    expect(res.status).toBe(201);
    expect(res.body.course).toMatchObject({
      title: 'HTTP caching',
      prompt: 'HTTP caching',
      createdAt: NOW,
      progress: { topicId: null },
    });
    expect(res.body.course.id).toMatch(UUID);
    expect(res.body.course.modules.map((m: { title: string }) => m.title)).toEqual([
      'Basics',
      'Checking copies',
    ]);
    const ids = res.body.course.modules.flatMap((m: { id: string; topics: { id: string }[] }) => [
      m.id,
      ...m.topics.map((t) => t.id),
    ]);
    expect(ids).toHaveLength(5);
    for (const id of ids) expect(id).toMatch(UUID);
  });

  it('rejects an empty or overlong topic before calling the AI', async () => {
    const calls: { prompt: string }[] = [];
    const app = courseApp(dir, fakeProvider({ outline: OUTLINE }, calls));

    expect((await request(app).post('/api/learn/courses').send({ topic: '   ' })).status).toBe(400);
    expect(
      (
        await request(app)
          .post('/api/learn/courses')
          .send({ topic: 'a'.repeat(301) })
      ).status,
    ).toBe(400);
    expect(calls).toHaveLength(0);
  });

  it('returns an error and saves nothing when the AI tool fails', async () => {
    const app = courseApp(
      dir,
      failingProvider(new AiError('FAILED', 'The AI tool did not answer.')),
    );

    const res = await request(app).post('/api/learn/courses').send({ topic: 'HTTP caching' });

    expect(res.status).toBe(502);
    expect(res.body).toEqual({ error: 'The AI tool did not answer.', code: 'FAILED' });
    expect((await request(app).get('/api/learn/courses')).body.courses).toEqual([]);
  });

  it('returns an error and saves nothing when the outline has too many topics', async () => {
    const app = courseApp(dir, fakeProvider({ outline: oversizedOutline() }));

    const res = await request(app).post('/api/learn/courses').send({ topic: 'Too big' });

    expect(res.status).toBe(502);
    expect(res.body.code).toBe('INVALID_OUTPUT');
    expect(res.body.error).toContain('24 topics');
    expect((await request(app).get('/api/learn/courses')).body.courses).toEqual([]);
  });
});

describe('GET /api/learn/courses', () => {
  it('lists saved courses with their topic counts', async () => {
    const app = courseApp(dir, fakeProvider({ outline: OUTLINE }));
    const course = await createCourse(app);

    const res = await request(app).get('/api/learn/courses');

    expect(res.status).toBe(200);
    expect(res.body.courses).toEqual([
      { id: course.id, title: 'HTTP caching', createdAt: NOW, topicCount: 3 },
    ]);
  });

  it('returns 404 for an unknown course and for a path-like id', async () => {
    const app = courseApp(dir, fakeProvider({ outline: OUTLINE }));

    expect((await request(app).get('/api/learn/courses/no-such-course')).status).toBe(404);
    expect((await request(app).get('/api/learn/courses/..%2Fsecret')).status).toBe(404);
  });
});

describe('PUT /api/learn/courses/:id/progress', () => {
  it('saves the topic last opened and returns the course', async () => {
    const app = courseApp(dir, fakeProvider({ outline: OUTLINE }));
    const course = await createCourse(app);
    const secondTopicId = course.modules[0].topics[1].id;

    const res = await request(app)
      .put(`/api/learn/courses/${course.id}/progress`)
      .send({ topicId: secondTopicId });
    const reread = await request(app).get(`/api/learn/courses/${course.id}`);

    expect(res.status).toBe(200);
    expect(res.body.course.progress).toEqual({ topicId: secondTopicId });
    expect(reread.body.course.progress).toEqual({ topicId: secondTopicId });
  });

  it('clears the saved topic when it is sent as null', async () => {
    const app = courseApp(dir, fakeProvider({ outline: OUTLINE }));
    const course = await createCourse(app);
    const topicId = course.modules[0].topics[0].id;
    await request(app).put(`/api/learn/courses/${course.id}/progress`).send({ topicId });

    const res = await request(app)
      .put(`/api/learn/courses/${course.id}/progress`)
      .send({ topicId: null });

    expect(res.body.course.progress).toEqual({ topicId: null });
  });

  it('rejects a topic that is not in the course and keeps the saved progress', async () => {
    const app = courseApp(dir, fakeProvider({ outline: OUTLINE }));
    const course = await createCourse(app);
    const topicId = course.modules[0].topics[0].id;
    await request(app).put(`/api/learn/courses/${course.id}/progress`).send({ topicId });

    const res = await request(app)
      .put(`/api/learn/courses/${course.id}/progress`)
      .send({ topicId: 'no-such-topic' });
    const reread = await request(app).get(`/api/learn/courses/${course.id}`);

    expect(res.status).toBe(400);
    expect(reread.body.course.progress).toEqual({ topicId });
  });

  it('returns 404 for an unknown course', async () => {
    const app = courseApp(dir, fakeProvider({ outline: OUTLINE }));

    const res = await request(app)
      .put('/api/learn/courses/no-such-course/progress')
      .send({ topicId: null });

    expect(res.status).toBe(404);
  });
});
