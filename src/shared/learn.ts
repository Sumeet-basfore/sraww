import { z } from 'zod';
import { diagramGraphSchema, graphEdgeSchema, graphNodeSchema } from './ai-schemas.ts';

/** Limits for lessons. A lesson is shorter than a free-form diagram on purpose. */
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
} as const;

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

/** A saved lesson. Only sources whose URLs were checked are kept. */
export const lessonSchema = lessonReplySchema.extend({
  id: z.string().regex(/^[a-zA-Z0-9_-]{1,64}$/),
  topic: z.string().min(1).max(LEARN_LIMITS.maxTopic),
  createdAt: z.string(),
  provider: z.enum(['claude', 'codex']),
});

export type Lesson = z.infer<typeof lessonSchema>;
