import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Lesson } from '../../src/shared/learn.ts';
import { createLessonStore } from '../../src/server/storage/lesson-store.ts';

let dir: string;
beforeEach(async () => {
  dir = await mkdtemp(path.join(os.tmpdir(), 'sraww-lessons-'));
});
afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

const LESSON: Lesson = {
  id: 'lesson-1',
  title: 'What a cache is',
  explanation: 'A cache keeps a copy of a response.',
  keyTerms: ['cache'],
  sources: [
    {
      title: 'MDN: HTTP caching',
      url: 'https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/Caching',
      points: ['Caches store copies of responses.'],
    },
  ],
  diagram: {
    nodes: [
      { id: 'client', label: 'Client' },
      { id: 'cache', label: 'Cache' },
    ],
    edges: [{ from: 'client', to: 'cache', label: 'request' }],
    direction: 'right',
    title: 'Caching',
  },
  topic: 'HTTP caching: What a cache is',
  createdAt: '2026-11-24T10:00:00.000Z',
  provider: 'claude',
  courseId: 'course-1',
  topicId: 'topic-1',
};

describe('lesson store', () => {
  it('finds the lesson saved for a course topic', async () => {
    const store = createLessonStore(dir);
    await store.save(LESSON);

    await expect(store.findForTopic('course-1', 'topic-1')).resolves.toEqual(LESSON);
  });

  it('finds nothing for another topic or another course', async () => {
    const store = createLessonStore(dir);
    await store.save(LESSON);

    await expect(store.findForTopic('course-1', 'topic-2')).resolves.toBeNull();
    await expect(store.findForTopic('course-2', 'topic-1')).resolves.toBeNull();
  });

  it('still reads a lesson saved before courses existed, with no course', async () => {
    const older = { ...LESSON, id: 'lesson-old', courseId: undefined, topicId: undefined };
    await mkdir(path.join(dir, 'lessons'), { recursive: true });
    await writeFile(path.join(dir, 'lessons', 'lesson-old.json'), JSON.stringify(older, null, 2));
    const store = createLessonStore(dir);

    await expect(store.read('lesson-old')).resolves.toMatchObject({ id: 'lesson-old' });
    await expect(store.findForTopic('course-1', 'topic-1')).resolves.toBeNull();
  });

  it('skips a damaged lesson file when it searches for a topic', async () => {
    const store = createLessonStore(dir);
    await store.save(LESSON);
    await writeFile(path.join(dir, 'lessons', 'broken.json'), '{');

    await expect(store.findForTopic('course-1', 'topic-1')).resolves.toEqual(LESSON);
  });
});
