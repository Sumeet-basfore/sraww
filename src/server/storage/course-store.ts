import path from 'node:path';
import { courseSchema, type Course, type CourseSummary } from '../../shared/learn.ts';
import { createJsonFolder } from './json-folder.ts';

export interface CourseStore {
  save(course: Course): Promise<void>;
  read(id: string): Promise<Course | null>;
  /** Every saved course, newest first. */
  list(): Promise<CourseSummary[]>;
}

/** Courses are stored as JSON under <dataDir>/courses, one file per course. */
export function createCourseStore(dataDir: string): CourseStore {
  const files = createJsonFolder(path.join(dataDir, 'courses'), courseSchema);

  return {
    save: (course) => files.write(course.id, course),
    read: (id) => files.read(id),
    async list() {
      const loaded = await Promise.all((await files.ids()).map((id) => files.read(id)));
      return loaded
        .filter((course): course is Course => course !== null)
        .map(summaryOf)
        .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
    },
  };
}

function summaryOf(course: Course): CourseSummary {
  return {
    id: course.id,
    title: course.title,
    createdAt: course.createdAt,
    topicCount: course.modules.reduce((count, module) => count + module.topics.length, 0),
  };
}
