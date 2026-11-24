import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { lessonSchema, type Lesson } from '../../shared/learn.ts';

const ID_PATTERN = /^[a-zA-Z0-9_-]{1,64}$/;

export interface LessonStore {
  save(lesson: Lesson): Promise<void>;
  read(id: string): Promise<Lesson | null>;
}

/** Lessons are stored as JSON under <dataDir>/lessons. Ids are checked so no path can escape that folder. */
export function createLessonStore(dataDir: string): LessonStore {
  const folder = path.join(dataDir, 'lessons');

  function fileFor(id: string): string | null {
    return ID_PATTERN.test(id) ? path.join(folder, `${id}.json`) : null;
  }

  return {
    async save(lesson: Lesson): Promise<void> {
      const file = fileFor(lesson.id);
      if (!file) throw new Error('Invalid lesson id.');
      await mkdir(folder, { recursive: true });
      // Write to a temporary file first, so a crash never leaves half a lesson behind.
      const temp = `${file}.tmp`;
      await writeFile(temp, JSON.stringify(lesson, null, 2), 'utf8');
      await rename(temp, file);
    },

    async read(id: string): Promise<Lesson | null> {
      const file = fileFor(id);
      if (!file) return null;
      try {
        const parsed = lessonSchema.safeParse(JSON.parse(await readFile(file, 'utf8')));
        return parsed.success ? parsed.data : null;
      } catch {
        // A missing or unreadable file is treated as "no such lesson".
        return null;
      }
    },
  };
}
