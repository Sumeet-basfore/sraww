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
  maxModules: 12,
  maxCourseTopics: 24,
  maxModuleTopics: 12,
  maxQuizQuestions: 5,
  maxQuizPrompt: 500,
  maxQuizSampleAnswer: 1200,
  maxQuizExplanation: 1000,
  maxQuizAttemptIds: 256,
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

function hasValidCourseTopicCount(course: { modules: { topics: readonly unknown[] }[] }): boolean {
  return (
    course.modules.reduce((total, module) => total + module.topics.length, 0) <=
    LEARN_LIMITS.maxCourseTopics
  );
}

/** What the model returns for a course. Model-supplied ids are ignored; the server assigns ids after validation. */
export const outlineReplySchema = z
  .object({
    title: z.string().min(1).max(LEARN_LIMITS.maxCourseTitle),
    modules: z.array(outlineModuleSchema).min(1).max(LEARN_LIMITS.maxModules),
  })
  .refine(hasValidCourseTopicCount, {
    path: ['modules'],
    message: `A course can have at most ${LEARN_LIMITS.maxCourseTopics} topics.`,
  });

export type OutlineReply = z.infer<typeof outlineReplySchema>;

const courseTopicSchema = outlineTopicSchema.extend({ id: idSchema });

/** A saved course. Every module and topic has a server-assigned id. `progress` is the topic opened last. */
export const courseSchema = z
  .object({
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
  })
  .refine(hasValidCourseTopicCount, {
    path: ['modules'],
    message: `A course can have at most ${LEARN_LIMITS.maxCourseTopics} topics.`,
  });

export type Course = z.infer<typeof courseSchema>;
export type CourseModule = Course['modules'][number];
export type CourseTopic = CourseModule['topics'][number];

export type CourseSummary = Pick<Course, 'id' | 'title' | 'createdAt'> & { topicCount: number };

/** Text generated for one quiz question. The server assigns each saved question its id. */
export const moduleQuizQuestionReplySchema = z.object({
  prompt: z.string().trim().min(1).max(LEARN_LIMITS.maxQuizPrompt),
  sampleAnswer: z.string().trim().min(1).max(LEARN_LIMITS.maxQuizSampleAnswer),
  explanation: z.string().trim().min(1).max(LEARN_LIMITS.maxQuizExplanation),
});

/** The provider's response does not include ids or results. */
export const moduleQuizReplySchema = z.object({
  questions: z.array(moduleQuizQuestionReplySchema).min(1).max(LEARN_LIMITS.maxQuizQuestions),
});

const resultCountSchema = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER);

/** A saved module quiz, kept beside but separate from the course's progress record. */
export const moduleQuizSchema = z
  .object({
    courseId: idSchema,
    moduleId: idSchema,
    sourceTopicIds: z.array(idSchema).min(1).max(LEARN_LIMITS.maxModuleTopics),
    createdAt: z.string().datetime(),
    questions: z
      .array(
        moduleQuizQuestionReplySchema.extend({
          id: idSchema,
        }),
      )
      .min(1)
      .max(LEARN_LIMITS.maxQuizQuestions),
    attempts: resultCountSchema,
    bestSelfRated: resultCountSchema,
    lastSelfRated: resultCountSchema,
    attemptIds: z.array(idSchema).max(LEARN_LIMITS.maxQuizAttemptIds),
  })
  .superRefine((quiz, context) => {
    if (new Set(quiz.sourceTopicIds).size !== quiz.sourceTopicIds.length) {
      context.addIssue({
        code: 'custom',
        path: ['sourceTopicIds'],
        message: 'Topic ids must be unique.',
      });
    }
    if (new Set(quiz.attemptIds).size !== quiz.attemptIds.length) {
      context.addIssue({
        code: 'custom',
        path: ['attemptIds'],
        message: 'Attempt ids must be unique.',
      });
    }
    if (quiz.attemptIds.length !== Math.min(quiz.attempts, LEARN_LIMITS.maxQuizAttemptIds)) {
      context.addIssue({
        code: 'custom',
        path: ['attemptIds'],
        message: 'Saved attempt ids must match the bounded retry window.',
      });
    }
    for (const field of ['bestSelfRated', 'lastSelfRated'] as const) {
      if (quiz[field] > quiz.questions.length) {
        context.addIssue({
          code: 'custom',
          path: [field],
          message: 'Self-rated counts cannot exceed the number of questions.',
        });
      }
    }
    if (quiz.bestSelfRated < quiz.lastSelfRated) {
      context.addIssue({
        code: 'custom',
        path: ['bestSelfRated'],
        message: 'Best self-rated count cannot be lower than the last count.',
      });
    }
    if (quiz.attempts === 0 && (quiz.bestSelfRated !== 0 || quiz.lastSelfRated !== 0)) {
      context.addIssue({
        code: 'custom',
        path: ['attempts'],
        message: 'A quiz without attempts cannot have saved self-ratings.',
      });
    }
  });

export type ModuleQuizReply = z.infer<typeof moduleQuizReplySchema>;
export type ModuleQuizQuestion = z.infer<typeof moduleQuizSchema>['questions'][number];
export type ModuleQuiz = z.infer<typeof moduleQuizSchema>;
export type ModuleQuizClient = Omit<ModuleQuiz, 'attemptIds'>;

/** Small result summary shown on the course outline without loading quiz questions. */
export type ModuleQuizResultSummary = Pick<
  ModuleQuiz,
  'attempts' | 'bestSelfRated' | 'lastSelfRated'
> & { questionCount: number };
