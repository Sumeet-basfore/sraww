import { z } from 'zod';
import { diagramGraphSchema, graphEdgeSchema, graphNodeSchema } from './ai-schemas.ts';

/** Limits for lessons and courses. A lesson is shorter than a free-form diagram on purpose. */
export const LEARN_LIMITS = {
  maxTopic: 300,
  maxTitle: 120,
  maxExplanation: 1500,
  maxKeyTerms: 8,
  maxKeyTerm: 60,
  maxSources: 5,
  maxSourceTitle: 160,
  maxUrl: 200,
  maxPoints: 6,
  maxPoint: 300,
  maxLessonNodes: 14,
  maxLessonEdges: 20,
  maxCourseTitle: 120,
  maxModuleTitle: 120,
  maxTopicTitle: 160,
  maxSummary: 240,
  maxModules: 8,
  maxCourseTopics: 12,
  maxModuleTopics: 12,
} as const;

/** Ids name files and URL segments, so they use the same safe alphabet everywhere. */
export const LEARN_ID_PATTERN = /^[a-zA-Z0-9_-]{1,64}$/;
const idSchema = z.string().regex(LEARN_ID_PATTERN);

/** A lesson's diagram uses the same node and arrow shapes as the rest of the app, with smaller caps. */
export const lessonDiagramSchema = diagramGraphSchema.extend({
  nodes: z.array(graphNodeSchema).min(1).max(LEARN_LIMITS.maxLessonNodes),
  edges: z.array(graphEdgeSchema).max(LEARN_LIMITS.maxLessonEdges),
});

/** One web source the lesson used. `points` are what the lesson took from it, in the app's own words. */
export const lessonSourceSchema = z.object({
  title: z.string().min(1).max(LEARN_LIMITS.maxSourceTitle),
  url: z.string().min(1).max(LEARN_LIMITS.maxUrl),
  points: z.array(z.string().min(1).max(LEARN_LIMITS.maxPoint)).min(1).max(LEARN_LIMITS.maxPoints),
});

/** What the model returns. Every source URL is checked by the server before the lesson is saved. */
export const lessonReplySchema = z.object({
  title: z.string().min(1).max(LEARN_LIMITS.maxTitle),
  explanation: z.string().min(1).max(LEARN_LIMITS.maxExplanation),
  keyTerms: z.array(z.string().min(1).max(LEARN_LIMITS.maxKeyTerm)).max(LEARN_LIMITS.maxKeyTerms),
  sources: z.array(lessonSourceSchema).min(1).max(LEARN_LIMITS.maxSources),
  diagram: lessonDiagramSchema,
});

export type LessonSource = z.infer<typeof lessonSourceSchema>;
export type LessonReply = z.infer<typeof lessonReplySchema>;

/**
 * A saved lesson. Only sources whose URLs were checked are kept. A lesson built for a course
 * records the course and topic it belongs to; older lessons have neither.
 */
export const lessonSchema = lessonReplySchema.extend({
  id: idSchema,
  topic: z.string().min(1).max(LEARN_LIMITS.maxTopic),
  createdAt: z.string(),
  provider: z.enum(['claude', 'codex']),
  courseId: idSchema.nullish(),
  topicId: idSchema.nullish(),
});

export type Lesson = z.infer<typeof lessonSchema>;

const outlineTopicSchema = z.object({
  title: z.string().min(1).max(LEARN_LIMITS.maxTopicTitle),
  summary: z.string().min(1).max(LEARN_LIMITS.maxSummary),
});

const outlineModuleSchema = z.object({
  title: z.string().min(1).max(LEARN_LIMITS.maxModuleTitle),
  topics: z.array(outlineTopicSchema).min(1).max(LEARN_LIMITS.maxModuleTopics),
});

/** What the model returns for a course. It never supplies ids; the server assigns them after this check. */
export const outlineReplySchema = z.object({
  title: z.string().min(1).max(LEARN_LIMITS.maxCourseTitle),
  modules: z.array(outlineModuleSchema).min(1).max(LEARN_LIMITS.maxModules),
});

export type OutlineReply = z.infer<typeof outlineReplySchema>;

const courseTopicSchema = outlineTopicSchema.extend({ id: idSchema });

/** A saved course. Every module and topic has a server-assigned id. `progress` is the topic opened last. */
export const courseSchema = z.object({
  id: idSchema,
  title: z.string().min(1).max(LEARN_LIMITS.maxCourseTitle),
  prompt: z.string().min(1).max(LEARN_LIMITS.maxTopic),
  createdAt: z.string(),
  modules: z
    .array(
      outlineModuleSchema.extend({
        id: idSchema,
        topics: z.array(courseTopicSchema).min(1).max(LEARN_LIMITS.maxModuleTopics),
      }),
    )
    .min(1)
    .max(LEARN_LIMITS.maxModules),
  progress: z.object({ topicId: idSchema.nullable() }),
});

export type Course = z.infer<typeof courseSchema>;
export type CourseModule = Course['modules'][number];
export type CourseTopic = CourseModule['topics'][number];

export type CourseSummary = Pick<Course, 'id' | 'title' | 'createdAt'> & { topicCount: number };
