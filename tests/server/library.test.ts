import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/server/app.ts';
import { loadConfig } from '../../src/server/config.ts';
import { createDiagramStore } from '../../src/server/storage/diagram-store.ts';

const HOST = '127.0.0.1:4317';
let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(path.join(os.tmpdir(), 'sraww-library-'));
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

function app() {
  return createApp(
    loadConfig({ DIAGRAMS_DIR: dir }),
    createDiagramStore(dir),
    path.join(dir, 'no-client'),
  );
}

const ITEM = {
  id: 'box-1',
  status: 'unpublished',
  created: 1_700_000_000_000,
  name: 'Box',
  elements: [{ type: 'rectangle', x: 0, y: 0, width: 100, height: 60 }],
};

describe('library API', () => {
  it('returns an empty library before anything is saved', async () => {
    const res = await request(app()).get('/api/library').set('Host', HOST);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ items: [] });
  });

  it('saves the library and returns the same items', async () => {
    const server = app();
    const put = await request(server)
      .put('/api/library')
      .set('Host', HOST)
      .send({ items: [ITEM] });
    expect(put.status).toBe(200);
    expect(put.body).toEqual({ count: 1 });

    const get = await request(server).get('/api/library').set('Host', HOST);
    expect(get.body.items).toEqual([ITEM]);
  });

  it('refuses items that are not library items', async () => {
    const res = await request(app())
      .put('/api/library')
      .set('Host', HOST)
      .send({ items: [{ id: 'x', created: 'yesterday', elements: 'not a list' }] });
    expect(res.status).toBe(400);
  });

  it('treats a damaged library file as empty instead of failing', async () => {
    await writeFile(path.join(dir, 'library.json'), '{ not json', 'utf8');
    const res = await request(app()).get('/api/library').set('Host', HOST);
    expect(res.body).toEqual({ items: [] });
  });

  it('does not list the library file as a drawing', async () => {
    await request(app())
      .put('/api/library')
      .set('Host', HOST)
      .send({ items: [ITEM] });
    const drawings = await request(app()).get('/api/diagrams').set('Host', HOST);
    expect(drawings.body.diagrams).toEqual([]);
  });
});
