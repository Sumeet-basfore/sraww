// Copies Excalidraw's font files into public/fonts so the editor works offline.
// Excalidraw loads fonts from EXCALIDRAW_ASSET_PATH, which is set to "/" in src/client/excalidraw-assets.ts.
import { cp, rm, access } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = path.join(root, 'node_modules/@excalidraw/excalidraw/dist/prod/fonts');
const target = path.join(root, 'public/fonts');

try {
  await access(source);
} catch {
  console.error(`Excalidraw fonts not found at ${source}. Run npm install first.`);
  process.exit(1);
}

await rm(target, { recursive: true, force: true });
await cp(source, target, { recursive: true });
console.log(`Copied Excalidraw fonts to ${path.relative(root, target)}`);
