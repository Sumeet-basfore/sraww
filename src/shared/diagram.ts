import { z } from 'zod';

/** File extension used for every saved diagram. */
export const DIAGRAM_EXTENSION = '.excalidraw';

/** Letters, digits, spaces, dashes and underscores; must start with a letter or digit. */
export const diagramNamePattern = /^[a-zA-Z0-9][a-zA-Z0-9 _-]{0,80}$/;

export const diagramNameSchema = z
  .string()
  .regex(
    diagramNamePattern,
    'Use 1–81 letters, digits, spaces, dashes or underscores, starting with a letter or digit.',
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
