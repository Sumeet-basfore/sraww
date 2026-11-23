import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { strToU8, zipSync } from 'fflate';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/server/app.ts';
import { loadConfig } from '../../src/server/config.ts';
import { createDiagramStore } from '../../src/server/storage/diagram-store.ts';
import { checkPath } from '../../src/shared/project-rules.ts';

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
