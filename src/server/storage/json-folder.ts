import { mkdir, readdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { z } from 'zod';
import { LEARN_ID_PATTERN } from '../../shared/learn.ts';

const JSON_EXTENSION = '.json';

/**
 * One JSON file per id in a folder. Every id is checked before it becomes a file name, so no
 * request can reach outside the folder. A damaged file, or one that fails the schema, reads as missing.
 */
export function createJsonFolder<T>(folder: string, schema: z.ZodType<T>) {
  function fileFor(id: string): string | null {
    return LEARN_ID_PATTERN.test(id) ? path.join(folder, `${id}${JSON_EXTENSION}`) : null;
  }

  return {
    async write(id: string, value: T): Promise<void> {
      const file = fileFor(id);
      if (!file) throw new Error('Invalid id.');
      await mkdir(folder, { recursive: true });
      // Write to a temporary file first, so a crash never leaves half a record behind.
      const temp = `${file}.tmp`;
      await writeFile(temp, JSON.stringify(value, null, 2), 'utf8');
      await rename(temp, file);
    },

    async read(id: string): Promise<T | null> {
      const file = fileFor(id);
      if (!file) return null;
      try {
        const parsed = schema.safeParse(JSON.parse(await readFile(file, 'utf8')));
        return parsed.success ? parsed.data : null;
      } catch {
        // A missing or unreadable file is treated as "no such record".
        return null;
      }
    },

    async ids(): Promise<string[]> {
      let names: string[];
      try {
        names = await readdir(folder);
      } catch (err) {
        if ((err as NodeJS.ErrnoException).code === 'ENOENT') return [];
        throw err;
      }
      return names
        .filter((name) => name.endsWith(JSON_EXTENSION))
        .map((name) => name.slice(0, -JSON_EXTENSION.length))
        .filter((id) => LEARN_ID_PATTERN.test(id));
    },
  };
}
