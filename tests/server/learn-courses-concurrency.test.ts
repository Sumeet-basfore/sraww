import { mkdtemp, readdir, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { fakeProvider, type GenerateCall } from '../fixtures/fake-provider.ts';
import { courseApp, createCourse, LESSON, OUTLINE } from '../fixtures/course-app.ts';

let dir: string;
beforeEach(async () => {
  dir = await mkdtemp(path.join(os.tmpdir(), 'sraww-course-concurrency-'));
});
afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe('two tabs at once', () => {
  it('opening the same topic twice at the same moment builds one lesson and shows it in both tabs', async () => {
    const calls: GenerateCall[] = [];
    const app = courseApp(
      dir,
      fakeProvider({ outline: OUTLINE, lesson: LESSON, lessonDelayMs: 100 }, calls),
    );
    const course = await createCourse(app);
    const topicId = course.modules[0].topics[0].id;
    const open = () =>
      request(app).post(`/api/learn/courses/${course.id}/topics/${topicId}/lesson`);

    const [first, second] = await Promise.all([open(), open()]);

    expect([first.status, second.status].sort()).toEqual([200, 201]);
    expect(second.body.lesson.id).toBe(first.body.lesson.id);
    expect(calls).toHaveLength(2);
    const lessonFiles = (await readdir(path.join(dir, 'lessons'))).filter((name) =>
      name.endsWith('.json'),
    );
    expect(lessonFiles).toHaveLength(1);
  });

  it('two progress saves at the same moment both succeed and leave one of the saved topics', async () => {
    const app = courseApp(dir, fakeProvider({ outline: OUTLINE, lesson: LESSON }));
    const course = await createCourse(app);
    const [firstTopic, secondTopic] = [
      course.modules[0].topics[0].id,
      course.modules[1].topics[0].id,
    ];
    const save = (topicId: string) =>
      request(app).put(`/api/learn/courses/${course.id}/progress`).send({ topicId });

    const results = await Promise.all([save(firstTopic), save(secondTopic)]);

    expect(results.map((res) => res.status)).toEqual([200, 200]);
    const stored = await request(app).get(`/api/learn/courses/${course.id}`);
    expect([firstTopic, secondTopic]).toContain(stored.body.course.progress.topicId);
    const leftovers = (await readdir(path.join(dir, 'courses'))).filter(
      (name) => !name.endsWith('.json'),
    );
    expect(leftovers).toEqual([]);
  });
});
