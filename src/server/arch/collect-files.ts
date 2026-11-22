import { readdir } from 'node:fs/promises';
import path from 'node:path';

export const SOURCE_EXTENSIONS = new Set([
  '.ts',
  '.tsx',
  '.mts',
  '.cts',
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
]);
const SKIPPED_FOLDERS = new Set(['node_modules', 'dist', 'build', 'coverage', 'out', 'vendor']);

export class ScanError extends Error {
  constructor(
    readonly code: 'NO_SOURCE_FILES' | 'TOO_MANY_FILES' | 'TIMEOUT' | 'FAILED',
    message: string,
  ) {
    super(message);
    this.name = 'ScanError';
  }
}

function isSourceFile(name: string): boolean {
  return SOURCE_EXTENSIONS.has(path.extname(name)) && !name.endsWith('.d.ts');
}

function isSkipped(name: string): boolean {
  return name.startsWith('.') || SKIPPED_FOLDERS.has(name);
}

/**
 * Lists source files under `root` with forward-slash paths relative to it. Hidden folders and
 * build or dependency folders are skipped. Stops with TOO_MANY_FILES past `maxFiles`.
 */
export async function collectSourceFiles(root: string, maxFiles: number): Promise<string[]> {
  const found: string[] = [];

  async function walk(relDir: string): Promise<void> {
    const entries = await readdir(path.join(root, relDir), { withFileTypes: true });
    for (const entry of entries) {
      const rel = relDir ? `${relDir}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        if (!isSkipped(entry.name)) await walk(rel);
      } else if (entry.isFile() && isSourceFile(entry.name)) {
        found.push(rel);
        if (found.length > maxFiles) {
          throw new ScanError(
            'TOO_MANY_FILES',
            `This folder has more than ${maxFiles} source files. Scan a smaller folder.`,
          );
        }
      }
    }
  }

  await walk('');
  return found.sort();
}
