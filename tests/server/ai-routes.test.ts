import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/server/app.ts';
import { loadConfig } from '../../src/server/config.ts';
import { createClaudeProvider } from '../../src/server/ai/providers/claude-cli.ts';
import { createCodexProvider } from '../../src/server/ai/providers/codex-cli.ts';
import type { AiServices } from '../../src/server/ai/services.ts';
import { createDiagramStore } from '../../src/server/storage/diagram-store.ts';

const HOST = '127.0.0.1:4317';
const fixture = (name: string): string => path.resolve('tests/fixtures/bin', name);
let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(path.join(os.tmpdir(), 'sraww-ai-routes-'));
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

function appWith(claudeBin: string, codexBin: string, timeoutMs = 10_000) {
  const workdir = path.join(dir, 'work');
  const ai: AiServices = {
    defaultProvider: 'claude',
    providers: {
      claude: createClaudeProvider({ bin: claudeBin, workdir, timeoutMs }),
      codex: createCodexProvider({ bin: codexBin, workdir, timeoutMs }),
    },
  };
  return createApp(loadConfig({}), createDiagramStore(dir), path.join(dir, 'no-client'), ai);
}

describe('AI routes', () => {
  it('generates a normalized graph from the default provider', async () => {
    const app = appWith(fixture('claude-ok'), fixture('codex-ok'));
    const res = await request(app)
      .post('/api/ai/generate')
      .set('Host', HOST)
      .send({ prompt: 'Show the API and its database' });
    expect(res.status).toBe(200);
    expect(res.body.provider).toBe('claude');
    expect(res.body.graph.nodes).toHaveLength(2);
  });

  it('uses the provider the request asks for', async () => {
    const app = appWith(fixture('claude-ok'), fixture('codex-ok'));
    const res = await request(app)
      .post('/api/ai/generate')
      .set('Host', HOST)
      .send({ prompt: 'Show the API and its database', provider: 'codex' });
    expect(res.status).toBe(200);
    expect(res.body.provider).toBe('codex');
  });

  it('rejects a prompt that is too short', async () => {
    const app = appWith(fixture('claude-ok'), fixture('codex-ok'));
    const res = await request(app).post('/api/ai/generate').set('Host', HOST).send({ prompt: 'a' });
    expect(res.status).toBe(400);
  });

  it('returns 503 with a clear code when the CLI is missing', async () => {
    const app = appWith(path.join(dir, 'missing-claude'), fixture('codex-ok'));
    const res = await request(app)
      .post('/api/ai/generate')
      .set('Host', HOST)
      .send({ prompt: 'Show the API' });
    expect(res.status).toBe(503);
    expect(res.body.code).toBe('NOT_INSTALLED');
  });

  it('returns 502 when the model answer is unusable', async () => {
    const app = appWith(fixture('claude-invalid'), fixture('codex-ok'));
    const res = await request(app)
      .post('/api/ai/generate')
      .set('Host', HOST)
      .send({ prompt: 'Show the API' });
    expect(res.status).toBe(502);
    expect(res.body.code).toBe('INVALID_OUTPUT');
  });

  it('reports both providers in the status endpoint', async () => {
    const app = appWith(fixture('claude-ok'), fixture('codex-logged-out'));
    const res = await request(app).get('/api/ai/status').set('Host', HOST);
    expect(res.status).toBe(200);
    expect(res.body.defaultProvider).toBe('claude');
    const byId = Object.fromEntries(res.body.providers.map((p: { id: string }) => [p.id, p]));
    expect(byId.claude.loggedIn).toBe(true);
    expect(byId.codex.loggedIn).toBe(false);
  });
});
