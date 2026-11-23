import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { libraryPayloadSchema, type LibraryPayload } from '../../shared/library.ts';

/** The file name cannot collide with a drawing: drawings always end in .excalidraw. */
const FILE_NAME = 'library.json';

/** Shown to the user, so it says what to do. Status 422 with a message the client may display. */
function damaged(): Error & { status: number; expose: boolean } {
  return Object.assign(
    new Error('The saved library file is damaged. Move library.json aside to start a new library.'),
    { status: 422, expose: true },
  );
}

/**
 * Keeps the Excalidraw library as one JSON file in the diagrams folder. A missing file means an
 * empty library. A file that exists but does not validate is an error: it is never treated as
 * empty, because the next save would overwrite it.
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
      throw damaged();
    }
    const parsed = libraryPayloadSchema.safeParse(json);
    if (!parsed.success) throw damaged();
    return parsed.data.items;
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
