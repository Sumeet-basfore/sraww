import path from 'node:path';
import { lessonSchema, type Lesson } from '../../shared/learn.ts';
import { createJsonFolder } from './json-folder.ts';

export interface LessonStore {
  save(lesson: Lesson): Promise<void>;
  read(id: string): Promise<Lesson | null>;
  /** The lesson built for one topic of one course, or null. Only the lesson file records that link. */
  findForTopic(courseId: string, topicId: string): Promise<Lesson | null>;
}

/** Lessons are stored as JSON under <dataDir>/lessons. */
export function createLessonStore(dataDir: string): LessonStore {
  const files = createJsonFolder(path.join(dataDir, 'lessons'), lessonSchema);

  return {
    save: (lesson) => files.write(lesson.id, lesson),
    read: (id) => files.read(id),
    async findForTopic(courseId, topicId) {
      for (const id of await files.ids()) {
        const lesson = await files.read(id);
        if (lesson?.courseId === courseId && lesson.topicId === topicId) return lesson;
      }
      return null;
    },
  };
}
