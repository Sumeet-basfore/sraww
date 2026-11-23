import { zipSync, type Zippable } from 'fflate';
import { checkPath, MAX_FILE_BYTES } from '../../shared/project-rules.ts';

/**
 * Packs a folder chosen in the browser into one zip, leaving out what the server would reject.
 * Package and build folders are skipped before their files are read, so a large node_modules
 * never has to be loaded. The server checks everything again.
 */
export async function zipFolder(files: readonly File[]): Promise<Uint8Array> {
  const entries: Zippable = {};
  for (const file of files) {
    const parts = (file.webkitRelativePath || file.name).split('/');
    // The first part is the folder the user chose; the project's paths start below it.
    const path = parts.length > 1 ? parts.slice(1).join('/') : parts.join('/');
    if (!checkPath(path).ok) continue;
    if (file.size > MAX_FILE_BYTES) continue;
    entries[path] = [new Uint8Array(await file.arrayBuffer()), { level: 6 }];
  }
  return zipSync(entries);
}

/** The zip of a single file chosen directly, for uploads that are already a zip. */
export async function readZipFile(file: File): Promise<Uint8Array> {
  return new Uint8Array(await file.arrayBuffer());
}
