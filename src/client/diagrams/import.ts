import {
  DIAGRAM_EXTENSION,
  diagramNameSchema,
  excalidrawSceneSchema,
  type ExcalidrawScene,
} from '../../shared/diagram.ts';

/** Largest file the import accepts. Matches the server's request body limit. */
export const MAX_IMPORT_BYTES = 10 * 1024 * 1024;

export class ImportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ImportError';
  }
}

export interface ImportedDrawing {
  name: string;
  scene: ExcalidrawScene;
}

/** A diagram name derived from a file name, always valid for the server. */
export function nameFromFileName(fileName: string): string {
  const base = fileName.replace(/\.(excalidraw|json)$/i, '');
  let cleaned = base
    .replace(/[^a-zA-Z0-9 _-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!/^[a-zA-Z0-9]/.test(cleaned)) cleaned = `Imported ${cleaned}`.trim();
  cleaned = cleaned.slice(0, 81).trim();
  return diagramNameSchema.safeParse(cleaned).success ? cleaned : 'Imported drawing';
}

/** Returns `base`, or `base (2)`, `base (3)`... so it doesn't collide with an existing name. */
export function uniqueName(base: string, existing: readonly string[]): string {
  const taken = new Set(existing);
  if (!taken.has(base)) return base;
  for (let n = 2; ; n += 1) {
    const candidate = `${base.slice(0, 81 - ` (${n})`.length)} (${n})`;
    if (!taken.has(candidate)) return candidate;
  }
}

/** Reads a user-chosen .excalidraw (or JSON) file and checks it is a drawing before anything is sent. */
export async function readDrawingFile(file: File): Promise<ImportedDrawing> {
  if (file.size > MAX_IMPORT_BYTES) {
    throw new ImportError('That file is larger than 10 MB.');
  }
  let json: unknown;
  try {
    json = JSON.parse(await file.text());
  } catch {
    throw new ImportError('That file is not valid JSON.');
  }
  const parsed = excalidrawSceneSchema.safeParse(json);
  if (!parsed.success) {
    throw new ImportError('That file is not an Excalidraw drawing.');
  }
  return { name: nameFromFileName(file.name), scene: parsed.data };
}

export const IMPORT_ACCEPT = `${DIAGRAM_EXTENSION},.json,application/json`;
