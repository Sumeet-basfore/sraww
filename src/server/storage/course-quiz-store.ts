import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  LEARN_ID_PATTERN,
  LEARN_LIMITS,
  moduleQuizSchema,
  type ModuleQuiz,
} from '../../shared/learn.ts';

export interface CourseQuizStore {
  read(courseId: string, moduleId: string): Promise<ModuleQuiz | null>;
  save(quiz: ModuleQuiz): Promise<void>;
  /** Add one completed self-rating, serializing read-modify-write per course and module. */
  recordResult(
    courseId: string,
    moduleId: string,
    attemptId: string,
    selfRatedCount: number,
  ): Promise<ModuleQuiz | null>;
}

/** Each module quiz is a sidecar under <dataDir>/learn-quizzes/<courseId>/<moduleId>.json. */
export function createCourseQuizStore(dataDir: string): CourseQuizStore {
  const root = path.join(dataDir, 'learn-quizzes');
  const resultQueues = new Map<string, Promise<void>>();

  function fileFor(courseId: string, moduleId: string): string | null {
    if (!LEARN_ID_PATTERN.test(courseId) || !LEARN_ID_PATTERN.test(moduleId)) return null;
    return path.join(root, courseId, `${moduleId}.json`);
  }

  async function write(quiz: ModuleQuiz): Promise<void> {
    const checked = moduleQuizSchema.parse(quiz);
    const file = fileFor(checked.courseId, checked.moduleId);
    if (!file) throw new Error('Invalid quiz id.');
    await mkdir(path.dirname(file), { recursive: true });
    const temp = `${file}.${randomUUID()}.tmp`;
    try {
      await writeFile(temp, `${JSON.stringify(checked, null, 2)}\n`, 'utf8');
      await rename(temp, file);
    } catch (err) {
      await rm(temp, { force: true });
      throw err;
    }
  }

  async function withResultLock<T>(key: string, action: () => Promise<T>): Promise<T> {
    const previous = resultQueues.get(key) ?? Promise.resolve();
    let release!: () => void;
    const current = new Promise<void>((resolve) => {
      release = resolve;
    });
    const queued = previous.then(() => current);
    resultQueues.set(key, queued);
    await previous;
    try {
      return await action();
    } finally {
      release();
      if (resultQueues.get(key) === queued) resultQueues.delete(key);
    }
  }

  return {
    async read(courseId, moduleId) {
      const file = fileFor(courseId, moduleId);
      if (!file) return null;
      try {
        const value: unknown = JSON.parse(await readFile(file, 'utf8'));
        const parsed = moduleQuizSchema.safeParse(value);
        if (
          !parsed.success ||
          parsed.data.courseId !== courseId ||
          parsed.data.moduleId !== moduleId
        ) {
          return null;
        }
        return parsed.data;
      } catch {
        return null;
      }
    },
    save: write,
    async recordResult(courseId, moduleId, attemptId, selfRatedCount) {
      const key = `${courseId}/${moduleId}`;
      if (!fileFor(courseId, moduleId)) return null;
      return withResultLock(key, async () => {
        const current = await this.read(courseId, moduleId);
        if (!current) return null;
        if (current.attemptIds.includes(attemptId)) return current;
        if (selfRatedCount > current.questions.length) {
          throw new RangeError('Self-rated count cannot exceed the number of questions.');
        }
        const updated = moduleQuizSchema.parse({
          ...current,
          attempts: current.attempts + 1,
          bestSelfRated: Math.max(current.bestSelfRated, selfRatedCount),
          lastSelfRated: selfRatedCount,
          attemptIds: [...current.attemptIds, attemptId].slice(-LEARN_LIMITS.maxQuizAttemptIds),
        });
        await write(updated);
        return updated;
      });
    },
  };
}
