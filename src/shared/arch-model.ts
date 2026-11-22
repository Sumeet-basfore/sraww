import { z } from 'zod';

export const ARCH_LIMITS = {
  maxComponents: 200,
  maxEdges: 800,
  maxMembers: 50,
  maxLayoutEntries: 1000,
} as const;

/** Stable ids: folder paths, `ext:<package>` for packages. No spaces, so they are safe in URLs. */
export const archIdSchema = z
  .string()
  .min(1)
  .max(200)
  .regex(/^[A-Za-z0-9_.:@/-]+$/, 'Ids may only use letters, digits and . _ : @ / -');

export const archNodeSchema = z.object({
  id: archIdSchema,
  label: z.string().min(1).max(160),
  kind: z.enum(['component', 'external']),
  group: z.string().max(200).nullable(),
  files: z.number().int().nonnegative(),
  members: z.array(z.string().max(300)).max(ARCH_LIMITS.maxMembers),
  /** Optional one-line description, written by AI naming. Never used for structure. */
  description: z.string().max(240).nullish(),
});

export const archEdgeSchema = z.object({
  from: archIdSchema,
  to: archIdSchema,
  count: z.number().int().positive(),
});

export const archGroupSchema = z.object({
  id: archIdSchema,
  label: z.string().min(1).max(160),
  members: z.array(archIdSchema).max(ARCH_LIMITS.maxComponents),
});

/** Architecture model: folders as components, packages as externals, and how they depend on each other. */
export const archModelSchema = z.object({
  version: z.literal(1),
  /** The allowed project this model was scanned from, so a re-scan knows where to read. */
  projectId: z.string().max(100).optional(),
  sourceLabel: z.string().max(200),
  generatedAt: z.string(),
  nodes: z.array(archNodeSchema).max(ARCH_LIMITS.maxComponents * 2),
  edges: z.array(archEdgeSchema).max(ARCH_LIMITS.maxEdges),
  groups: z.array(archGroupSchema).max(ARCH_LIMITS.maxComponents),
});

export type ArchNode = z.infer<typeof archNodeSchema>;
export type ArchEdge = z.infer<typeof archEdgeSchema>;
export type ArchGroup = z.infer<typeof archGroupSchema>;
export type ArchModel = z.infer<typeof archModelSchema>;

/** Where the user dragged each node. Kept apart from the model so a re-scan keeps the layout. */
export const archLayoutSchema = z.object({
  version: z.literal(1),
  positions: z
    .record(archIdSchema, z.object({ x: z.number().finite(), y: z.number().finite() }))
    .refine((p) => Object.keys(p).length <= ARCH_LIMITS.maxLayoutEntries, 'Too many positions.'),
});

export type ArchLayout = z.infer<typeof archLayoutSchema>;

/** What changed between two scans. `hasBaseline` is false on the first scan. */
export interface ArchDiff {
  hasBaseline: boolean;
  addedNodes: string[];
  removedNodes: string[];
  addedEdges: string[];
  removedEdges: string[];
}
