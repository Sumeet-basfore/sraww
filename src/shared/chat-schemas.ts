import { z } from 'zod';
import { graphEdgeSchema, graphNodeSchema } from './ai-schemas.ts';

export const CHAT_LIMITS = {
  maxShapes: 150,
  maxArrows: 300,
  maxMessage: 2000,
  maxHistory: 12,
  maxOps: 40,
} as const;

/** The diagram as the chat sees it: shape ids and labels, and which shapes arrows join. */
export const sceneSummarySchema = z.object({
  shapes: z
    .array(
      z.object({
        id: z.string().min(1).max(200),
        kind: z.enum(['rectangle', 'ellipse', 'diamond']),
        label: z.string().max(200),
      }),
    )
    .max(CHAT_LIMITS.maxShapes),
  arrows: z
    .array(
      z.object({
        id: z.string().min(1).max(200),
        from: z.string().max(200).nullish(),
        to: z.string().max(200).nullish(),
        label: z.string().max(200).nullish(),
      }),
    )
    .max(CHAT_LIMITS.maxArrows),
});

export type SceneSummary = z.infer<typeof sceneSummarySchema>;

export const chatOpSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('addNodes'), nodes: z.array(graphNodeSchema).min(1).max(20) }),
  z.object({ type: z.literal('addEdges'), edges: z.array(graphEdgeSchema).min(1).max(40) }),
  z.object({
    type: z.literal('deleteElements'),
    ids: z.array(z.string().min(1).max(200)).min(1).max(40),
  }),
]);

export type ChatOp = z.infer<typeof chatOpSchema>;

/** What the model answers: a reply for the user, and optional edits to the diagram. */
export const chatReplySchema = z.object({
  reply: z.string().max(1500),
  ops: z.array(chatOpSchema).max(CHAT_LIMITS.maxOps),
});

export type ChatReply = z.infer<typeof chatReplySchema>;

export const chatRequestSchema = z.object({
  message: z.string().trim().min(1).max(CHAT_LIMITS.maxMessage),
  history: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        text: z.string().max(CHAT_LIMITS.maxMessage),
      }),
    )
    .max(CHAT_LIMITS.maxHistory)
    .default([]),
  summary: sceneSummarySchema,
  provider: z.enum(['claude', 'codex']).optional(),
});

export type ChatRequest = z.infer<typeof chatRequestSchema>;
