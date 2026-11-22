import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/server/app.ts';
import { loadConfig } from '../../src/server/config.ts';
import { createArchStore } from '../../src/server/storage/arch-store.ts';
import { createDiagramStore } from '../../src/server/storage/diagram-store.ts';
import type { ArchModel } from '../../src/shared/arch-model.ts';

const HOST = '127.0.0.1:4317';
let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(path.join(os.tmpdir(), 'sraww-arch-routes-'));
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

const MODEL: ArchModel = {
  version: 1,
  sourceLabel: 'demo',
  generatedAt: '2026-01-01T00:00:00.000Z',
  nodes: [],
  edges: [],
  groups: [],
};

describe('architecture routes', () => {
  it('returns 404 when no model exists for the name', async () => {
    const app = createApp(loadConfig({}), createDiagramStore(dir), path.join(dir, 'none'));
    const res = await request(app).get('/api/arch/demo').set('Host', HOST);
    expect(res.status).toBe(404);
  });

  it('returns the model with a null layout, then the saved layout', async () => {
    await createArchStore(dir).writeModel('demo', MODEL);
    const app = createApp(loadConfig({}), createDiagramStore(dir), path.join(dir, 'none'));

    const first = await request(app).get('/api/arch/demo').set('Host', HOST);
    expect(first.body.model).toEqual(MODEL);
    expect(first.body.layout).toBeNull();

    const put = await request(app)
      .put('/api/arch/demo/layout')
      .set('Host', HOST)
      .send({ version: 1, positions: { 'src/a': { x: 5, y: 6 } } });
    expect(put.status).toBe(200);

    const second = await request(app).get('/api/arch/demo').set('Host', HOST);
    expect(second.body.layout.positions['src/a']).toEqual({ x: 5, y: 6 });
  });

  it('rejects a layout with non-numeric positions', async () => {
    const app = createApp(loadConfig({}), createDiagramStore(dir), path.join(dir, 'none'));
    const res = await request(app)
      .put('/api/arch/demo/layout')
      .set('Host', HOST)
      .send({ version: 1, positions: { a: { x: 'left', y: 1 } } });
    expect(res.status).toBe(400);
  });

  it('resets the layout', async () => {
    const store = createArchStore(dir);
    await store.writeLayout('demo', { version: 1, positions: {} });
    const app = createApp(loadConfig({}), createDiagramStore(dir), path.join(dir, 'none'));
    const res = await request(app).delete('/api/arch/demo/layout').set('Host', HOST);
    expect(res.status).toBe(204);
    expect(await store.readLayout('demo')).toBeNull();
  });
});
