import { z } from 'zod';

/** Hard limits on AI output. The model's answer is cut down to these before anything is drawn. */
export const GRAPH_LIMITS = {
  maxNodes: 80,
  maxEdges: 160,
  maxLabel: 60,
  maxTitle: 80,
  maxId: 40,
} as const;

/** Shapes the model may choose. "note" is text with no border; "rounded" is a rectangle with corners. */
export const SHAPES = ['rectangle', 'rounded', 'ellipse', 'diamond', 'note'] as const;
/** Colours are named, so the model can use them to mean something (for example, "red" for risks). */
export const COLORS = ['neutral', 'blue', 'green', 'amber', 'red', 'violet'] as const;
export const EDGE_STYLES = ['solid', 'dashed'] as const;
/** Which ends of an arrow have a head: the end only, both ends, or neither (a plain line). */
export const ARROW_HEADS = ['end', 'both', 'none'] as const;
export const DIRECTIONS = ['down', 'right'] as const;

const idPattern = /^[a-zA-Z0-9_-]{1,40}$/;

export const shapeSchema = z.enum(SHAPES);
export const colorSchema = z.enum(COLORS);

export const graphNodeSchema = z.object({
  id: z.string().regex(idPattern, 'Use letters, digits, dashes or underscores for ids.'),
  label: z.string().min(1).max(GRAPH_LIMITS.maxLabel),
  // Optional fields are nullish, not optional: strict structured-output modes (Codex) require every key.
  shape: shapeSchema.nullish(),
  color: colorSchema.nullish(),
  /** Nodes with the same group are drawn inside one dashed frame labelled with the group's name. */
  group: z.string().min(1).max(GRAPH_LIMITS.maxId).nullish(),
});

export const graphEdgeSchema = z.object({
  from: z.string().min(1).max(GRAPH_LIMITS.maxId),
  to: z.string().min(1).max(GRAPH_LIMITS.maxId),
  label: z.string().max(GRAPH_LIMITS.maxLabel).nullish(),
  style: z.enum(EDGE_STYLES).nullish(),
  arrow: z.enum(ARROW_HEADS).nullish(),
});

/** A diagram as nodes and edges. The model never supplies coordinates; layout is computed in code. */
export const diagramGraphSchema = z.object({
  nodes: z.array(graphNodeSchema).min(1).max(GRAPH_LIMITS.maxNodes),
  edges: z.array(graphEdgeSchema).max(GRAPH_LIMITS.maxEdges),
  /** Whether the layout flows top to bottom (default) or left to right. */
  direction: z.enum(DIRECTIONS).nullish(),
  /** A heading drawn above the diagram. */
  title: z.string().max(GRAPH_LIMITS.maxTitle).nullish(),
});

export type GraphNode = z.infer<typeof graphNodeSchema>;
export type GraphEdge = z.infer<typeof graphEdgeSchema>;
export type DiagramGraph = z.infer<typeof diagramGraphSchema>;
export type Shape = (typeof SHAPES)[number];
export type Color = (typeof COLORS)[number];
