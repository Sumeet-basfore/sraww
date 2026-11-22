import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { applyNames, buildNamingPrompt } from '../../src/server/arch/naming.ts';
import { createApp } from '../../src/server/app.ts';
import { createClaudeProvider } from '../../src/server/ai/providers/claude-cli.ts';
import { createCodexProvider } from '../../src/server/ai/providers/codex-cli.ts';
import type { AiServices } from '../../src/server/ai/services.ts';
import { loadConfig } from '../../src/server/config.ts';
import { createArchStore } from '../../src/server/storage/arch-store.ts';
import { createDiagramStore } from '../../src/server/storage/diagram-store.ts';
import type { ArchModel } from '../../src/shared/arch-model.ts';

const HOST = '127.0.0.1:4317';
const fixture = (name: string): string => path.resolve('tests/fixtures/bin', name);
let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(path.join(os.tmpdir(), 'sraww-naming-'));
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

describe('applyNames', () => {
  it('changes only labels and descriptions; edges and groups stay exactly the same', () => {
    const { model, applied } = applyNames(MODEL, {
      components: [{ id: 'src', label: 'Source', description: 'Application code.' }],
    });
    expect(applied).toBe(1);
    expect(model.nodes.find((n) => n.id === 'src')).toMatchObject({
      label: 'Source',
      description: 'Application code.',
    });
    expect(model.edges).toEqual(MODEL.edges);
    expect(model.groups).toEqual(MODEL.groups);
  });

  it('ignores ids that are not components of the model, including packages', () => {
    const { applied, model } = applyNames(MODEL, {
      components: [
        { id: 'ghost', label: 'Ghost', description: 'x' },
        { id: 'ext:express', label: 'Renamed', description: 'x' },
      ],
    });
    expect(applied).toBe(0);
    expect(model.nodes).toEqual(MODEL.nodes);
  });

  it('cleans control characters out of new labels', () => {
    const { model } = applyNames(MODEL, {
      components: [{ id: 'src', label: 'Core\u0007  code', description: '   ' }],
    });
    expect(model.nodes.find((n) => n.id === 'src')?.label).toBe('Core code');
    expect(model.nodes.find((n) => n.id === 'src')?.description).toBeNull();
  });
});

describe('buildNamingPrompt', () => {
  it('sends folder ids, file names and links, and treats them as data', () => {
    const prompt = buildNamingPrompt(MODEL);
    expect(prompt).toContain('"id":"src"');
    expect(prompt).toContain('util.ts');
    expect(prompt).toContain('{"id":"ext:express","count":1}');
    expect(prompt).toContain('<components>');
  });
});

describe('POST /api/arch/models/:name/name', () => {
  it('stores AI names on the model without touching its links', async () => {
    const store = createArchStore(dir);
    await store.writeModel('demo', MODEL);
    const workdir = path.join(dir, 'work');
    const ai: AiServices = {
      defaultProvider: 'claude',
      providers: {
        claude: createClaudeProvider({ bin: fixture('claude-naming'), workdir, timeoutMs: 10_000 }),
        codex: createCodexProvider({ bin: fixture('codex-ok'), workdir, timeoutMs: 10_000 }),
      },
    };
    const app = createApp(loadConfig({}), createDiagramStore(dir), path.join(dir, 'none'), ai);
    const res = await request(app).post('/api/arch/models/demo/name').set('Host', HOST);

    expect(res.status).toBe(200);
    expect(res.body.applied).toBe(1);
    const stored = await store.readModel('demo');
    expect(stored?.nodes.find((n) => n.id === 'src')?.label).toBe('Source code');
    expect(stored?.edges).toEqual(MODEL.edges);
  });
});
