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
  dir = await mkdtemp(path.join(os.tmpdir(), 'sraww-arch-findings-'));
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

const MODEL: ArchModel = {
  version: 1,
  sourceLabel: 'demo',
  generatedAt: '2026-01-01T00:00:00.000Z',
  nodes: [
    { id: 'a', label: 'A', kind: 'component', group: null, files: 1, members: ['a.ts'] },
    { id: 'b', label: 'B', kind: 'component', group: null, files: 1, members: ['b.ts'] },
  ],
  edges: [
    { from: 'a', to: 'b', count: 1 },
    { from: 'b', to: 'a', count: 1 },
  ],
  groups: [],
};

describe('GET /api/arch/models/:name/findings', () => {
  it('returns 404 when the model is missing', async () => {
    const app = createApp(loadConfig({}), createDiagramStore(dir), path.join(dir, 'none'));
    const response = await request(app).get('/api/arch/models/missing/findings').set('Host', HOST);

    expect(response.status).toBe(404);
  });

  it('returns findings for a saved model with a cycle', async () => {
    await createArchStore(dir).writeModel('cycle', MODEL);
    const app = createApp(loadConfig({}), createDiagramStore(dir), path.join(dir, 'none'));
    const response = await request(app).get('/api/arch/models/cycle/findings').set('Host', HOST);

    expect(response.status).toBe(200);
    expect(response.body.findings).toEqual(
      expect.arrayContaining([expect.objectContaining({ kind: 'cycle', nodes: ['a', 'b'] })]),
    );
  });
});
