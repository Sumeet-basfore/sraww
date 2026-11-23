import { mkdtemp, readFile, readdir, rm, stat } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { strToU8, Zip, ZipDeflate, ZipPassThrough, zipSync } from 'fflate';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/server/app.ts';
import { loadConfig } from '../../src/server/config.ts';
import { createDiagramStore } from '../../src/server/storage/diagram-store.ts';
import { checkPath } from '../../src/shared/project-rules.ts';
import {
  MAX_FILE_BYTES,
  MAX_OVERSIZED_ENTRIES,
  MAX_OVERSIZED_METADATA_BYTES,
} from '../../src/shared/project-rules.ts';

const HOST = '127.0.0.1:4317';
let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(path.join(os.tmpdir(), 'sraww-projects-'));
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

function app() {
  return createApp(
    loadConfig({
      DIAGRAMS_DIR: path.join(dir, 'diagrams'),
      PROJECTS_DIR: path.join(dir, 'projects'),
    }),
    createDiagramStore(path.join(dir, 'diagrams')),
    path.join(dir, 'no-client'),
  );
}

function zip(files: Record<string, string | Uint8Array>): Buffer {
  const entries: Record<string, Uint8Array> = {};
  for (const [name, content] of Object.entries(files)) {
    entries[name] = typeof content === 'string' ? strToU8(content) : content;
  }
  return Buffer.from(zipSync(entries));
}

function duplicateCompanionZip(): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Uint8Array[] = [];
    const archive = new Zip((error, chunk, final) => {
      if (error) {
        reject(error);
        return;
      }
      chunks.push(chunk);
      if (final) resolve(Buffer.concat(chunks));
    });
    for (const value of ['[]', '[]']) {
      const entry = new ZipPassThrough('.__sraww_oversized__.json');
      archive.add(entry);
      entry.push(strToU8(value), true);
    }
    archive.end();
  });
}

function oversizedCompanionBomb(): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Uint8Array[] = [];
    const archive = new Zip((error, chunk, final) => {
      if (error) {
        reject(error);
        return;
      }
      chunks.push(chunk);
      if (final) resolve(Buffer.concat(chunks));
    });
    const entry = new ZipDeflate('.__sraww_oversized__.json', { level: 6 });
    const block = new Uint8Array(256 * 1024).fill(0x20);
    const first = Uint8Array.from(block);
    first.set(strToU8('[]'));
    archive.add(entry);
    for (let index = 0; index < 255; index += 1) entry.push(index === 0 ? first : block);
    entry.push(block, true);
    archive.end();
  });
}

function upload(body: Buffer, query = 'name=Sample&consent=yes') {
  return request(app())
    .post(`/api/projects?${query}`)
    .set('Host', HOST)
    .set('Content-Type', 'application/zip')
    .send(body);
}

describe('path rules', () => {
  it('keeps ordinary source files', () => {
    expect(checkPath('src/app.ts')).toEqual({ ok: true });
  });

  it('refuses paths that leave the folder', () => {
    expect(checkPath('../secret.ts').ok).toBe(false);
    expect(checkPath('/etc/passwd').ok).toBe(false);
    expect(checkPath('src/../../x.ts').ok).toBe(false);
  });

  it('refuses package, build and cache folders', () => {
    expect(checkPath('node_modules/left-pad/index.js').ok).toBe(false);
    expect(checkPath('apps/web/dist/main.js').ok).toBe(false);
  });

  it('refuses credential, key and lock files', () => {
    expect(checkPath('.env').ok).toBe(false);
    expect(checkPath('config/.env.production').ok).toBe(false);
    expect(checkPath('deploy/server.pem').ok).toBe(false);
    expect(checkPath('package-lock.json').ok).toBe(false);
  });

  it('refuses binary files', () => {
    expect(checkPath('public/logo.png').ok).toBe(false);
  });
});

describe('uploading a project', () => {
  it('refuses an upload without the privacy notice accepted', async () => {
    const res = await upload(zip({ 'a.ts': 'export const a = 1;' }), 'name=Sample');
    expect(res.status).toBe(400);
  });

  it('keeps source files, lists what was excluded and why, and stores the files', async () => {
    const res = await upload(
      zip({
        'src/app.ts': 'export const app = 1;',
        'node_modules/pkg/index.js': 'module.exports = 1;',
        '.env': 'DATABASE_URL=postgres://x',
        'public/logo.png': new Uint8Array([137, 80, 78, 71, 0, 1]),
        'src/config.ts': 'const key = "AKIAABCDEFGHIJKLMNOP";',
        'package-lock.json': '{}',
      }),
    );
    expect(res.status).toBe(201);
    expect(res.body.fileCount).toBe(1);
    const reasons = Object.fromEntries(
      (res.body.excluded as Array<{ path: string; reason: string }>).map((e) => [e.path, e.reason]),
    );
    expect(reasons['node_modules/pkg/index.js']).toMatch(/package/);
    expect(reasons['.env']).toMatch(/credential/);
    expect(reasons['public/logo.png']).toMatch(/binary/);
    expect(reasons['src/config.ts']).toMatch(/secret/);
    expect(reasons['package-lock.json']).toMatch(/lock/);

    const stored = path.join(dir, 'projects', res.body.id, 'files', 'src', 'app.ts');
    expect(await readFile(stored, 'utf8')).toBe('export const app = 1;');
    await expect(stat(path.join(dir, 'projects', res.body.id, 'files', '.env'))).rejects.toThrow();
  });

  it('records validated oversized-file metadata without receiving those file bytes', async () => {
    const res = await upload(
      zip({
        'src/app.ts': 'export {};',
        '.__sraww_oversized__.json': JSON.stringify([
          { path: 'src/large.ts', size: MAX_FILE_BYTES + 1 },
        ]),
      }),
    );
    expect(res.status).toBe(201);
    expect(res.body.excluded).toContainEqual({ path: 'src/large.ts', reason: 'larger than 1 MB' });
    await expect(
      stat(path.join(dir, 'projects', res.body.id, 'files', 'src', 'large.ts')),
    ).rejects.toThrow();
  });

  it('rejects a 64 MiB companion entry by its declared size before inflation', async () => {
    const archive = await oversizedCompanionBomb();
    expect(archive.byteLength).toBeLessThan(60 * 1024 * 1024);
    const res = await upload(archive);
    expect(res.status).toBe(400);
    await expect(readdir(path.join(dir, 'projects'))).rejects.toThrow();
  });

  it('rejects a duplicated companion entry', async () => {
    const res = await upload(await duplicateCompanionZip());
    expect(res.status).toBe(400);
  });

  it('rejects oversized metadata with more than the allowed number of items', async () => {
    const metadata = Array.from({ length: MAX_OVERSIZED_ENTRIES + 1 }, (_, index) => ({
      path: `large-${index}.ts`,
      size: MAX_FILE_BYTES + 1,
    }));
    expect(Buffer.byteLength(JSON.stringify(metadata))).toBeLessThanOrEqual(
      MAX_OVERSIZED_METADATA_BYTES,
    );
    const res = await upload(zip({ '.__sraww_oversized__.json': JSON.stringify(metadata) }));
    expect(res.status).toBe(400);
  });

  it('rejects oversized metadata that claims a path also kept in the archive', async () => {
    const res = await upload(
      zip({
        'src/secret.ts': 'SECRET',
        '.__sraww_oversized__.json': JSON.stringify([
          { path: 'src/secret.ts', size: MAX_FILE_BYTES + 1 },
        ]),
      }),
    );
    expect(res.status).toBe(400);
    await expect(readdir(path.join(dir, 'projects'))).rejects.toThrow();
  });

  it('rejects oversized metadata that claims a path excluded by server checks', async () => {
    const res = await upload(
      zip({
        'src/secret.ts': 'const key = "AKIAABCDEFGHIJKLMNOP";',
        '.__sraww_oversized__.json': JSON.stringify([
          { path: 'src/secret.ts', size: MAX_FILE_BYTES + 1 },
        ]),
      }),
    );
    expect(res.status).toBe(400);
  });

  it('rejects duplicated paths in oversized metadata', async () => {
    const item = { path: 'src/large.ts', size: MAX_FILE_BYTES + 1 };
    const res = await upload(zip({ '.__sraww_oversized__.json': JSON.stringify([item, item]) }));
    expect(res.status).toBe(400);
  });

  it.each([MAX_FILE_BYTES, MAX_FILE_BYTES + 0.5, null])(
    'rejects oversized metadata with an invalid size %s',
    async (size) => {
      const res = await upload(
        zip({
          '.__sraww_oversized__.json': JSON.stringify([{ path: 'src/large.ts', size }]),
        }),
      );
      expect(res.status).toBe(400);
    },
  );

  it('rejects malformed oversized-file metadata', async () => {
    const res = await upload(
      zip({
        'src/app.ts': 'export {};',
        '.__sraww_oversized__.json': JSON.stringify([
          { path: '../escape.ts', size: MAX_FILE_BYTES + 1 },
        ]),
      }),
    );
    expect(res.status).toBe(400);
  });

  it('refuses an archive whose entries try to leave the folder, and keeps nothing from it', async () => {
    const res = await upload(zip({ '../escape.ts': 'x', 'ok/keep.ts': 'export {};' }));
    expect(res.status).toBe(201);
    expect(res.body.fileCount).toBe(1);
    expect(res.body.excluded.map((e: { reason: string }) => e.reason)).toContain('an unsafe path');
  });

  it('refuses a body that is not a zip archive', async () => {
    const res = await upload(Buffer.from('not a zip at all'));
    expect(res.status).toBe(400);
  });

  it('lists uploaded projects and deletes one with its files', async () => {
    const created = await upload(zip({ 'a.ts': 'export const a = 1;' }));
    const server = app();
    const listed = await request(server).get('/api/projects').set('Host', HOST);
    expect(listed.body.projects.map((p: { id: string }) => p.id)).toContain(created.body.id);

    await request(server).delete(`/api/projects/${created.body.id}`).set('Host', HOST).expect(204);
    await expect(stat(path.join(dir, 'projects', created.body.id))).rejects.toThrow();
  });

  it('refuses ids that are not project ids', async () => {
    const res = await request(app()).delete('/api/projects/..%2Fdiagrams').set('Host', HOST);
    expect(res.status).toBe(404);
  });

  it('offers an uploaded project to the architecture scan', async () => {
    await upload(zip({ 'a.ts': 'export const a = 1;' }), 'name=My%20App&consent=yes');
    const res = await request(app()).get('/api/arch/projects').set('Host', HOST);
    const labels = res.body.projects.map((p: { label: string }) => p.label);
    expect(labels).toContain('My App (uploaded)');
  });
});
