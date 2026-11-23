import { z } from 'zod';

/** File extension used for every saved diagram. */
export const DIAGRAM_EXTENSION = '.excalidraw';
export const MAX_DIAGRAM_FILENAME_BYTES = 200;

const RESERVED_WINDOWS_NAMES = new Set([
  'con',
  'prn',
  'aux',
  'nul',
  ...Array.from({ length: 9 }, (_, index) => `com${index + 1}`),
  ...Array.from({ length: 9 }, (_, index) => `lpt${index + 1}`),
]);

/** Unicode letters and digits, spaces, dashes and underscores; safe as a single filename stem. */
export const diagramNamePattern = /^[\p{L}\p{N}][\p{L}\p{N} _-]{0,80}$/u;
export const diagramNameError =
  'Use 1–81 Unicode letters, digits, spaces, dashes or underscores, starting with a letter or digit; the filename must be at most 200 UTF-8 bytes.';

export function diagramNameByteLength(name: string): number {
  return new TextEncoder().encode(`${name}${DIAGRAM_EXTENSION}`).length;
}

export const diagramNameSchema = z
  .string()
  .regex(diagramNamePattern, diagramNameError)
  .refine(
    (name) =>
      diagramNameByteLength(name) <= MAX_DIAGRAM_FILENAME_BYTES &&
      !RESERVED_WINDOWS_NAMES.has(name.toLowerCase()),
    diagramNameError,
  );

export const excalidrawElementSchema = z.looseObject({
  id: z.string().min(1).max(200),
  type: z.string().min(1),
});

/** The subset of Excalidraw's .excalidraw file format the server validates. Extra fields pass through. */
export const excalidrawSceneSchema = z.looseObject({
  type: z.literal('excalidraw'),
  version: z.number().int().nonnegative().default(2),
  source: z.string().optional(),
  elements: z.array(excalidrawElementSchema).max(50_000),
  appState: z.record(z.string(), z.unknown()).default({}),
  files: z.record(z.string(), z.unknown()).default({}),
});

export type ExcalidrawScene = z.infer<typeof excalidrawSceneSchema>;

export function emptyScene(): ExcalidrawScene {
  return {
    type: 'excalidraw',
    version: 2,
    source: 'sraww',
    elements: [],
    appState: {},
    files: {},
  };
}
