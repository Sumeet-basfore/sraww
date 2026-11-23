import { unzipSync, zipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import { readZipFile, zipFolder } from '../../src/client/projects/zip-folder.ts';

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

  it('skips package folders, but sends credential files and binaries for the server to list', async () => {
    const zip = await zipFolder([
      pickedFile('shop/src/index.ts', 'export {};'),
      pickedFile('shop/node_modules/left-pad/index.js', 'module.exports = 1;'),
      pickedFile('shop/.env', 'TOKEN=1'),
      pickedFile('shop/logo.png', 'png'),
    ]);
    expect(Object.keys(unzipSync(zip)).sort()).toEqual(['.env', 'logo.png', 'src/index.ts']);
  });
});

describe('readZipFile', () => {
  it('drops package folders from a project zip and keeps everything else for the server', async () => {
    const bytes = zipSync({
      'shop/node_modules/left-pad/index.js': new TextEncoder().encode('module.exports = 1;'),
      'shop/src/index.ts': new TextEncoder().encode('export {};'),
      'shop/.env': new TextEncoder().encode('TOKEN=1'),
    });
    const file = new File([bytes as BlobPart], 'shop.zip');

    const packed = await readZipFile(file);

    expect(Object.keys(unzipSync(packed)).sort()).toEqual(['shop/.env', 'shop/src/index.ts']);
  });
});
