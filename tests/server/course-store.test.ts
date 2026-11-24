import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Course } from '../../src/shared/learn.ts';
import { createCourseStore } from '../../src/server/storage/course-store.ts';

let dir: string;
beforeEach(async () => {
  dir = await mkdtemp(path.join(os.tmpdir(), 'sraww-courses-'));
});
afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

const COURSE: Course = {
  id: 'course-1',
  title: 'HTTP caching',
  prompt: 'HTTP caching',
  createdAt: '2026-11-24T10:00:00.000Z',
  modules: [
    {
      id: 'module-1',
      title: 'Basics',
      topics: [
        { id: 'topic-1', title: 'What a cache is', summary: 'A cache keeps a copy of a response.' },
        { id: 'topic-2', title: 'Freshness', summary: 'A copy stays fresh for a set time.' },
      ],
    },
    {
      id: 'module-2',
      title: 'Checking copies',
      topics: [
        {
          id: 'topic-3',
          title: 'Validators',
          summary: 'A validator asks whether a copy is still good.',
        },
      ],
    },
  ],
  progress: { topicId: null },
};

/** A course with the given number of topics, for the list. */
function courseWith(id: string, createdAt: string, topicCount: number): Course {
  return {
    id,
    title: `Course ${id}`,
    prompt: `Course ${id}`,
    createdAt,
    modules: [
      {
        id: `${id}-module`,
        title: 'Only module',
        topics: Array.from({ length: topicCount }, (_, i) => ({
          id: `${id}-topic-${i + 1}`,
          title: `Topic ${i + 1}`,
          summary: 'One plain sentence.',
        })),
      },
    ],
    progress: { topicId: null },
  };
}

describe('course store', () => {
  it('reads back a saved course unchanged', async () => {
    const store = createCourseStore(dir);
    await store.save(COURSE);

    await expect(store.read('course-1')).resolves.toEqual(COURSE);
  });

  it('reads a bad, unknown or path-like id as null', async () => {
    const store = createCourseStore(dir);
    await store.save(COURSE);

    await expect(store.read('no-such-course')).resolves.toBeNull();
    await expect(store.read('../course-1')).resolves.toBeNull();
    await expect(store.read('bad id!')).resolves.toBeNull();
  });

  it('reads a damaged file and a file of the wrong shape as null', async () => {
    await mkdir(path.join(dir, 'courses'), { recursive: true });
    await writeFile(path.join(dir, 'courses', 'broken.json'), '{not json');
    await writeFile(
      path.join(dir, 'courses', 'wrong.json'),
      JSON.stringify({ id: 'wrong', title: 'No modules' }),
    );
    const store = createCourseStore(dir);

    await expect(store.read('broken')).resolves.toBeNull();
    await expect(store.read('wrong')).resolves.toBeNull();
  });

  it('lists nothing before any course is saved', async () => {
    await expect(createCourseStore(dir).list()).resolves.toEqual([]);
  });

  it('lists courses newest first with their topic counts and skips a damaged file', async () => {
    const store = createCourseStore(dir);
    await store.save(courseWith('older', '2026-11-01T09:00:00.000Z', 3));
    await store.save(courseWith('newest', '2026-11-24T10:00:00.000Z', 1));
    await store.save(courseWith('middle', '2026-11-10T08:00:00.000Z', 2));
    await writeFile(path.join(dir, 'courses', 'damaged.json'), '{');

    await expect(store.list()).resolves.toEqual([
      {
        id: 'newest',
        title: 'Course newest',
        createdAt: '2026-11-24T10:00:00.000Z',
        topicCount: 1,
      },
      {
        id: 'middle',
        title: 'Course middle',
        createdAt: '2026-11-10T08:00:00.000Z',
        topicCount: 2,
      },
      { id: 'older', title: 'Course older', createdAt: '2026-11-01T09:00:00.000Z', topicCount: 3 },
    ]);
  });
});
