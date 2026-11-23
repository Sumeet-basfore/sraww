import { unzipSync, zipSync } from 'fflate';
import { describe, expect, it, vi } from 'vitest';
import { readZipFile, zipFolder } from '../../src/client/projects/zip-folder.ts';

/** A file as a folder picker reports it: the path starts with the folder the user chose. */
function pickedFile(relativePath: string, text: string): File {
  const file = new File([text], relativePath.split('/').pop() ?? 'file');
  Object.defineProperty(file, 'webkitRelativePath', { value: relativePath });
  return file;
}

function setUnsupportedCompression(archive: Uint8Array, entryName: string): Uint8Array {
  const bytes = Uint8Array.from(archive);
  const view = new DataView(bytes.buffer);
  const nameBytes = new TextEncoder().encode(entryName);
  let found = false;
  for (let offset = 0; offset < bytes.length - 30; offset += 1) {
    const signature = view.getUint32(offset, true);
    if (signature === 0x04034b50) {
      const nameLength = view.getUint16(offset + 26, true);
      const name = bytes.subarray(offset + 30, offset + 30 + nameLength);
      if (
        name.length === nameBytes.length &&
        !name.some((byte, index) => byte !== nameBytes[index])
      ) {
        view.setUint16(offset + 8, 99, true);
        found = true;
      }
    } else if (signature === 0x02014b50) {
      const nameLength = view.getUint16(offset + 28, true);
      const name = bytes.subarray(offset + 46, offset + 46 + nameLength);
      if (
        name.length === nameBytes.length &&
        !name.some((byte, index) => byte !== nameBytes[index])
      ) {
        view.setUint16(offset + 10, 99, true);
        found = true;
      }
    }
  }
  if (!found) throw new Error(`Missing ZIP entry ${entryName}`);
  return bytes;
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

  it('lists oversized folder files without reading their bytes', async () => {
    const large = pickedFile('shop/src/large.ts', 'x'.repeat(1024 * 1024 + 1));
    const read = vi.spyOn(large, 'arrayBuffer');
    const zip = await zipFolder([large]);
    const entries = unzipSync(zip);
    expect(Object.keys(entries)).toEqual(['.__sraww_oversized__.json']);
    expect(JSON.parse(new TextDecoder().decode(entries['.__sraww_oversized__.json']))).toEqual([
      { path: 'src/large.ts', size: 1024 * 1024 + 1 },
    ]);
    expect(read).not.toHaveBeenCalled();
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

  it('records oversized zip entries without unpacking their contents', async () => {
    const bytes = setUnsupportedCompression(
      zipSync({
        'src/large.ts': new Uint8Array(1024 * 1024 + 1),
        'src/small.ts': new TextEncoder().encode('export {};'),
      }),
      'src/large.ts',
    );
    const packed = await readZipFile(new File([bytes as BlobPart], 'shop.zip'));
    const entries = unzipSync(packed);
    expect(Object.keys(entries)).toEqual(['src/small.ts', '.__sraww_oversized__.json']);
    expect(JSON.parse(new TextDecoder().decode(entries['.__sraww_oversized__.json']))).toEqual([
      { path: 'src/large.ts', size: 1024 * 1024 + 1 },
    ]);
  });
});
