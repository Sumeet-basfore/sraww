import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { libraryPayloadSchema, type LibraryPayload } from '../../shared/library.ts';

/** The file name cannot collide with a drawing: drawings always end in .excalidraw. */
const FILE_NAME = 'library.json';

/**
 * Keeps the Excalidraw library as one JSON file in the diagrams folder. A missing file means an
 * empty library. A file that does not validate is treated as empty, and the next save replaces it.
 */
export function createLibraryStore(dir: string) {
  const root = path.resolve(dir);
  const file = path.join(root, FILE_NAME);

  async function read(): Promise<LibraryPayload['items']> {
    let text: string;
    try {
      text = await readFile(file, 'utf8');
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') return [];
      throw err;
    }
    let json: unknown;
    try {
      json = JSON.parse(text);
    } catch {
      return [];
    }
    const parsed = libraryPayloadSchema.safeParse(json);
    return parsed.success ? parsed.data.items : [];
  }

  async function write(input: unknown): Promise<LibraryPayload['items']> {
    const valid = libraryPayloadSchema.parse(input);
    await mkdir(root, { recursive: true });
    const tmp = `${file}.${randomUUID()}.tmp`;
    try {
      await writeFile(tmp, `${JSON.stringify(valid, null, 2)}\n`, 'utf8');
      await rename(tmp, file);
    } catch (err) {
      await rm(tmp, { force: true });
      throw err;
    }
    return valid.items;
  }

  return { read, write };
}

export type LibraryStore = ReturnType<typeof createLibraryStore>;
