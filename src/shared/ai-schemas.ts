import { z } from 'zod';

/** Hard limits on AI output. The model's answer is cut down to these before anything is drawn. */
export const GRAPH_LIMITS = {
  maxNodes: 80,
  maxEdges: 160,
  maxLabel: 60,
  maxId: 40,
} as const;

const idPattern = /^[a-zA-Z0-9_-]{1,40}$/;

export const graphNodeSchema = z.object({
  id: z.string().regex(idPattern, 'Use letters, digits, dashes or underscores for ids.'),
  label: z.string().min(1).max(GRAPH_LIMITS.maxLabel),
  // Optional fields are nullish, not optional: strict structured-output modes (Codex) require every key.
  shape: z.enum(['rectangle', 'ellipse', 'diamond']).nullish(),
  group: z.string().min(1).max(GRAPH_LIMITS.maxId).nullish(),
});

export const graphEdgeSchema = z.object({
  from: z.string().min(1).max(GRAPH_LIMITS.maxId),
  to: z.string().min(1).max(GRAPH_LIMITS.maxId),
  label: z.string().max(GRAPH_LIMITS.maxLabel).nullish(),
});

/** A diagram as nodes and edges. The model never supplies coordinates; layout is computed in code. */
export const diagramGraphSchema = z.object({
  nodes: z.array(graphNodeSchema).min(1).max(GRAPH_LIMITS.maxNodes),
  edges: z.array(graphEdgeSchema).max(GRAPH_LIMITS.maxEdges),
});

export type GraphNode = z.infer<typeof graphNodeSchema>;
export type GraphEdge = z.infer<typeof graphEdgeSchema>;
export type DiagramGraph = z.infer<typeof diagramGraphSchema>;
