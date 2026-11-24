import type { Course, CourseSummary, Lesson } from '../../shared/learn.ts';
import { request } from './api.ts';

/** One course, with the id of the lesson already built for each topic that has one. */
export interface CourseDetail {
  course: Course;
  builtLessons: Record<string, string>;
}

const coursePath = (id: string): string => `/learn/courses/${encodeURIComponent(id)}`;

export const learnApi = {
  create(topic: string): Promise<{ lesson: Lesson; skippedSources: number }> {
    return request('/learn/lessons', { method: 'POST', body: JSON.stringify({ topic }) });
  },
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
};
