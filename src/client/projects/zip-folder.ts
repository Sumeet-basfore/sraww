import { unzipSync, zipSync, type Zippable } from 'fflate';
import { isInsideExcludedFolder, MAX_FILE_BYTES } from '../../shared/project-rules.ts';

/**
 * Packs a folder chosen in the browser into one zip. The browser skips the contents of package,
 * build, cache and version-control folders, and files over 1 MB, without reading them. Those are not
 * listed anywhere. Every other file goes to the server, which lists whatever it leaves out and why.
 */
export async function zipFolder(files: readonly File[]): Promise<Uint8Array> {
  const entries: Zippable = {};
  for (const file of files) {
    const parts = (file.webkitRelativePath || file.name).split('/');
    // The first part is the folder the user chose; the project's paths start below it.
    const path = parts.length > 1 ? parts.slice(1).join('/') : parts.join('/');
    if (isInsideExcludedFolder(path)) continue;
    if (file.size > MAX_FILE_BYTES) continue;
    entries[path] = [new Uint8Array(await file.arrayBuffer()), { level: 6 }];
  }
  return zipSync(entries);
}

/**
 * Re-packs a zip chosen directly, without the package, build, cache and version-control folders and
 * without files over 1 MB. A project zipped with its dependency folders can otherwise be too large
 * to send. Skipped entries are never decompressed. Everything else goes to the server to be listed.
 */
export async function readZipFile(file: File): Promise<Uint8Array> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const kept = unzipSync(bytes, {
    filter: (entry) =>
      !entry.name.endsWith('/') &&
      !isInsideExcludedFolder(entry.name) &&
      entry.originalSize <= MAX_FILE_BYTES,
  });
  const entries: Zippable = {};
  for (const [path, data] of Object.entries(kept)) entries[path] = [data, { level: 6 }];
  return zipSync(entries);
}
