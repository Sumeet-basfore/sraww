import type {
  Course,
  CourseSummary,
  Lesson,
  ModuleQuizClient,
  ModuleQuizResultSummary,
} from '../../shared/learn.ts';
import { request } from './api.ts';

/** One course, with the id of the lesson already built for each topic that has one. */
export interface CourseDetail {
  course: Course;
  builtLessons: Record<string, string>;
  quizResults: Record<string, ModuleQuizResultSummary>;
}

const coursePath = (id: string): string => `/learn/courses/${encodeURIComponent(id)}`;

export const learnApi = {
  get(id: string): Promise<{ lesson: Lesson }> {
    return request(`/learn/lessons/${encodeURIComponent(id)}`);
  },
  courses(): Promise<{ courses: CourseSummary[] }> {
    return request('/learn/courses');
  },
  createCourse(topic: string): Promise<{ course: Course }> {
    return request('/learn/courses', { method: 'POST', body: JSON.stringify({ topic }) });
  },
  course(id: string): Promise<CourseDetail> {
    return request(coursePath(id));
  },
  openTopic(courseId: string, topicId: string): Promise<{ lesson: Lesson }> {
    return request(`${coursePath(courseId)}/topics/${encodeURIComponent(topicId)}/lesson`, {
      method: 'POST',
    });
  },
  setProgress(courseId: string, topicId: string | null): Promise<{ course: Course }> {
    return request(`${coursePath(courseId)}/progress`, {
      method: 'PUT',
      body: JSON.stringify({ topicId }),
    });
  },
  practiceModule(courseId: string, moduleId: string): Promise<{ quiz: ModuleQuizClient }> {
    return request(`${coursePath(courseId)}/modules/${encodeURIComponent(moduleId)}/quiz`, {
      method: 'POST',
    });
  },
  saveQuizResult(
    courseId: string,
    moduleId: string,
    attemptId: string,
    selfRatedCount: number,
  ): Promise<{ quiz: ModuleQuizClient }> {
    return request(`${coursePath(courseId)}/modules/${encodeURIComponent(moduleId)}/quiz/results`, {
      method: 'PUT',
      body: JSON.stringify({ attemptId, selfRatedCount }),
    });
  },
};
