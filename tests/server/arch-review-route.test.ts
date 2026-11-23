import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createClaudeProvider } from '../../src/server/ai/providers/claude-cli.ts';
import { createCodexProvider } from '../../src/server/ai/providers/codex-cli.ts';
import { loadConfig } from '../../src/server/config.ts';
import { createApp } from '../../src/server/app.ts';
import { createArchStore } from '../../src/server/storage/arch-store.ts';
import { createDiagramStore } from '../../src/server/storage/diagram-store.ts';
import { testServices } from '../fixtures/ai-services.ts';
import type { ArchModel } from '../../src/shared/arch-model.ts';

const HOST = '127.0.0.1:4317';
const fixture = (name: string): string => path.resolve('tests/fixtures/bin', name);
let dir: string;
beforeEach(async () => {
  dir = await mkdtemp(path.join(os.tmpdir(), 'sraww-review-route-'));
});
afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

const MODEL: ArchModel = {
  version: 1,
  sourceLabel: 'demo',
  generatedAt: '2026-01-01T00:00:00.000Z',
  nodes: [
    {
      id: 'src',
      label: 'src',
      kind: 'component',
      group: 'src',
      files: 2,
      members: ['src/app.ts', 'src/lib/util.ts'],
    },
    {
      id: 'src/lib',
      label: 'src/lib',
      kind: 'component',
      group: 'src',
      files: 1,
      members: ['src/lib/util.ts'],
    },
    { id: 'ext:express', label: 'express', kind: 'external', group: null, files: 0, members: [] },
  ],
  edges: [
    { from: 'src', to: 'src/lib', count: 1 },
    { from: 'src', to: 'ext:express', count: 1 },
  ],
  groups: [{ id: 'src', label: 'src', members: ['src', 'src/lib'] }],
};

async function setup(withModel = true) {
  const store = createArchStore(dir);
  if (withModel) await store.writeModel('demo', MODEL);
  const workdir = path.join(dir, 'work');
  const ai = testServices({
    claude: createClaudeProvider({ bin: fixture('claude-review'), workdir, timeoutMs: 10_000 }),
    codex: createCodexProvider({ bin: fixture('codex-ok'), workdir, timeoutMs: 10_000 }),
  });
  return {
    store,
    app: createApp(loadConfig({}), createDiagramStore(dir), path.join(dir, 'none'), ai),
  };
}

describe('architecture review route', () => {
  it('reviews and saves the model metadata', async () => {
    const { app, store } = await setup();
    const res = await request(app).post('/api/arch/models/demo/review').set('Host', HOST);
    expect(res.status).toBe(200);
    expect(res.body.review.review.summary).toBe('Review summary');
    expect(res.body.review.provider).toBe('claude');
    expect(res.body.review.modelGeneratedAt).toBe(MODEL.generatedAt);
    expect((await store.readReview('demo'))?.review).toEqual(res.body.review.review);
  });

  it('prunes unknown evidence and reports skipped findings', async () => {
    const { app } = await setup();
    const res = await request(app).post('/api/arch/models/demo/review').set('Host', HOST);
    expect(res.body.skipped).toBe(1);
    expect(res.body.review.review.findings).toHaveLength(1);
    expect(res.body.review.review.findings[0].evidence).toEqual(['src']);
  });

  it('returns 404 when the model is missing', async () => {
    const { app } = await setup(false);
    const res = await request(app).post('/api/arch/models/demo/review').set('Host', HOST);
    expect(res.status).toBe(404);
  });

  it('does not append review data to the model file', async () => {
    const { app } = await setup();
    const modelPath = path.join(dir, 'demo.arch.json');
    const before = await readFile(modelPath);
    await request(app).post('/api/arch/models/demo/review').set('Host', HOST).expect(200);
    await request(app).post('/api/arch/models/demo/review').set('Host', HOST).expect(200);
    expect(await readFile(modelPath)).toEqual(before);
  });

  it('returns null when no saved review exists and marks stale reviews', async () => {
    const { app, store } = await setup();
    expect((await request(app).get('/api/arch/models/demo/review').set('Host', HOST)).body).toEqual(
      { review: null, stale: false },
    );
    await store.writeReview('demo', {
      version: 1,
      generatedAt: 'now',
      modelGeneratedAt: 'old',
      provider: 'claude',
      review: {
        summary: 'x',
        findings: [{ severity: 'low', title: 'x', evidence: ['src'], suggestion: 'x' }],
      },
    });
    expect(
      (await request(app).get('/api/arch/models/demo/review').set('Host', HOST)).body.stale,
    ).toBe(true);
  });
});
