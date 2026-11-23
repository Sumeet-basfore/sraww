import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { strToU8, zipSync } from 'fflate';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/server/app.ts';
import { loadConfig } from '../../src/server/config.ts';
import { intakeError } from '../../src/server/projects/intake.ts';
import { createDiagramStore } from '../../src/server/storage/diagram-store.ts';

const HOST = '127.0.0.1:4317';
let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(path.join(os.tmpdir(), 'sraww-github-projects-'));
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

function zip(files: Record<string, string>): Uint8Array {
  return zipSync(
    Object.fromEntries(Object.entries(files).map(([name, text]) => [name, strToU8(text)])),
  );
}

function app(fetchRepo: (target: { repo: string; ref?: string }) => Promise<Uint8Array>) {
  return createApp(
    loadConfig({
      DIAGRAMS_DIR: path.join(dir, 'diagrams'),
      PROJECTS_DIR: path.join(dir, 'projects'),
    }),
    createDiagramStore(path.join(dir, 'diagrams')),
    path.join(dir, 'no-client'),
    undefined,
    { fetchRepo },
  );
}

function importRepo(
  fetchRepo: (target: { repo: string; ref?: string }) => Promise<Uint8Array>,
  body = {},
) {
  return request(app(fetchRepo))
    .post('/api/projects/github')
    .set('Host', HOST)
    .send({ repo: 'acme/shop', name: 'Shop', consent: true, ...body });
}

describe('GitHub project import', () => {
  it('stores kept files without the codeload wrapper and records the source', async () => {
    const fetchRepo = async () => zip({ 'shop-main/src/app.ts': 'export const app = 1;' });
    const res = await importRepo(fetchRepo, { ref: 'main' });
    expect(res.status).toBe(201);
    expect(res.body.source).toEqual({ kind: 'github', repo: 'acme/shop', ref: 'main' });
    expect(res.body.fileCount).toBe(1);
    expect(
      await readFile(path.join(dir, 'projects', res.body.id, 'files', 'src', 'app.ts'), 'utf8'),
    ).toBe('export const app = 1;');
    const projects = await request(app(fetchRepo)).get('/api/arch/projects').set('Host', HOST);
    expect(projects.body.projects.map((project: { label: string }) => project.label)).toContain(
      'acme/shop (GitHub)',
    );
  });

  it.each([{ consent: undefined }, { consent: false }])(
    'requires explicit consent: %o',
    async (body) => {
      const res = await importRepo(async () => zip({ 'shop-main/a.ts': 'x' }), body);
      expect(res.status).toBe(400);
    },
  );

  it.each(['acme', 'acme/shop/extra', '../shop'])('rejects invalid repository %s', async (repo) => {
    const res = await request(app(async () => zip({})))
      .post('/api/projects/github')
      .set('Host', HOST)
      .send({ repo, name: 'Shop', consent: true });
    expect(res.status).toBe(400);
  });

  it('returns 422 when every file is excluded', async () => {
    const res = await importRepo(async () => zip({ 'shop-main/node_modules/pkg/index.js': 'x' }));
    expect(res.status).toBe(422);
  });

  it('returns 404 when GitHub cannot find the repository', async () => {
    const res = await importRepo(async () => {
      throw intakeError('Repository or branch not found.', 404);
    });
    expect(res.status).toBe(404);
  });
});
