import { unzipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import { zipFolder } from '../../src/client/projects/zip-folder.ts';

/** A file as a folder picker reports it: the path starts with the folder the user chose. */
function pickedFile(relativePath: string, text: string): File {
  const file = new File([text], relativePath.split('/').pop() ?? 'file');
  Object.defineProperty(file, 'webkitRelativePath', { value: relativePath });
  return file;
}

describe('zipFolder', () => {
  it('keeps the project’s own paths, below the folder the user picked', async () => {
    const zip = await zipFolder([
      pickedFile('shop/src/index.ts', 'export {};'),
      pickedFile('shop/README.md', '# shop'),
    ]);
    const entries = unzipSync(zip);
    expect(Object.keys(entries).sort()).toEqual(['README.md', 'src/index.ts']);
  });

  it('leaves out package folders, credential files and binaries before reading them', async () => {
    const zip = await zipFolder([
      pickedFile('shop/src/index.ts', 'export {};'),
      pickedFile('shop/node_modules/left-pad/index.js', 'module.exports = 1;'),
      pickedFile('shop/.env', 'TOKEN=1'),
      pickedFile('shop/logo.png', 'png'),
    ]);
    expect(Object.keys(unzipSync(zip))).toEqual(['src/index.ts']);
  });
});
