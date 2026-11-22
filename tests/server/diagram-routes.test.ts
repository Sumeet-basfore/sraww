import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/server/app.ts';
import { loadConfig } from '../../src/server/config.ts';
import { createDiagramStore } from '../../src/server/storage/diagram-store.ts';
import { emptyScene } from '../../src/shared/diagram.ts';

const HOST = '127.0.0.1:4317';
let dir: string;
let app: ReturnType<typeof createApp>;

beforeEach(async () => {
  dir = await mkdtemp(path.join(os.tmpdir(), 'sraww-routes-'));
  app = createApp(loadConfig({}), createDiagramStore(dir));
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe('diagram routes', () => {
  it('creates, lists and reads a diagram', async () => {
    const created = await request(app)
      .post('/api/diagrams')
      .set('Host', HOST)
      .send({ name: 'system' });
    expect(created.status).toBe(201);

    const list = await request(app).get('/api/diagrams').set('Host', HOST);
    expect(list.body.diagrams.map((d: { name: string }) => d.name)).toEqual(['system']);

    const one = await request(app).get('/api/diagrams/system').set('Host', HOST);
    expect(one.status).toBe(200);
    expect(one.body.type).toBe('excalidraw');
  });

  it('saves a scene with PUT', async () => {
    await request(app).post('/api/diagrams').set('Host', HOST).send({ name: 'd' });
    const scene = { ...emptyScene(), elements: [{ id: 'e1', type: 'rectangle' }] };
    const saved = await request(app).put('/api/diagrams/d').set('Host', HOST).send(scene);
    expect(saved.status).toBe(200);
    const back = await request(app).get('/api/diagrams/d').set('Host', HOST);
    expect(back.body.elements).toHaveLength(1);
  });

  it('renames, duplicates and deletes', async () => {
    await request(app).post('/api/diagrams').set('Host', HOST).send({ name: 'a' });
    const renamed = await request(app)
      .patch('/api/diagrams/a')
      .set('Host', HOST)
      .send({ name: 'b' });
    expect(renamed.status).toBe(200);

    const dup = await request(app)
      .post('/api/diagrams/b/duplicate')
      .set('Host', HOST)
      .send({ name: 'b copy' });
    expect(dup.status).toBe(201);

    const del = await request(app).delete('/api/diagrams/b').set('Host', HOST);
    expect(del.status).toBe(204);
  });

  it('answers 404 for a missing diagram', async () => {
    const res = await request(app).get('/api/diagrams/nope').set('Host', HOST);
    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/not found/i);
  });

  it('rejects path traversal in the name with 400', async () => {
    const res = await request(app).get('/api/diagrams/..%2F..%2Fetc%2Fpasswd').set('Host', HOST);
    expect(res.status).toBe(400);
  });

  it('returns 400 with a readable message for a bad body', async () => {
    const res = await request(app)
      .put('/api/diagrams/x')
      .set('Host', HOST)
      .send({ type: 'not-excalidraw' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBeTruthy();
  });

  it('returns 409 when creating a name that already exists', async () => {
    await request(app).post('/api/diagrams').set('Host', HOST).send({ name: 'dup' });
    const again = await request(app).post('/api/diagrams').set('Host', HOST).send({ name: 'dup' });
    expect(again.status).toBe(409);
  });
});
