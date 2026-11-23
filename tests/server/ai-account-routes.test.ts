import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import request from 'supertest';
import type { Express } from 'express';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/server/app.ts';
import { loadConfig } from '../../src/server/config.ts';
import { createAiServices, type AiServices } from '../../src/server/ai/services.ts';
import { createDiagramStore } from '../../src/server/storage/diagram-store.ts';
import type { ProvidersView } from '../../src/shared/ai-account.ts';

const HOST = '127.0.0.1:4317';
const fixture = (name: string): string => path.resolve('tests/fixtures/bin', name);
let dir: string;
let services: AiServices | null = null;

beforeEach(async () => {
  dir = await mkdtemp(path.join(os.tmpdir(), 'sraww-account-routes-'));
});

afterEach(async () => {
  services?.close();
  services = null;
  await rm(dir, { recursive: true, force: true });
});

function appWith(bins: { claude: string; codex: string }): Express {
  const config = loadConfig({
    DIAGRAMS_DIR: path.join(dir, 'diagrams'),
    AI_WORKDIR: path.join(dir, 'work'),
    AI_SETTINGS_FILE: path.join(dir, 'ai.json'),
    CLAUDE_BIN: bins.claude,
    CODEX_BIN: bins.codex,
    AI_TIMEOUT_MS: '10000',
  });
  services = createAiServices(config);
  return createApp(
    config,
    createDiagramStore(path.join(dir, 'diagrams')),
    path.join(dir, 'none'),
    services,
  );
}

/** Polls the Claude sign-in until it reaches a status, as the settings page does. */
async function pollClaudeLogin(app: Express, status: string): Promise<unknown> {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const res = await request(app).get('/api/ai/providers/claude/login').set('Host', HOST);
    const login = res.body.login as { status?: string } | null;
    if (login?.status === status) return login;
    await new Promise((resolve) => setTimeout(resolve, 30));
  }
  throw new Error(`Claude sign-in never reached ${status}.`);
}

describe('AI account routes', () => {
  it('lists both tools with their account, models and current choice', async () => {
    const app = appWith({ claude: fixture('claude-ok'), codex: fixture('codex-app') });
    const res = await request(app).get('/api/ai/providers').set('Host', HOST);

    expect(res.status).toBe(200);
    const body = res.body as ProvidersView;
    expect(body.defaultProvider).toBe('claude');
    const codex = body.providers.find((p) => p.id === 'codex');
    expect(codex).toMatchObject({
      loggedIn: true,
      account: { email: 'person@example.test' },
      cliDefault: { model: 'gpt-test-1', effort: 'high' },
    });
    expect(codex?.models.map((m) => m.id)).toEqual(['gpt-test-1']);
    expect(body.providers.find((p) => p.id === 'claude')?.loggedIn).toBe(true);
  });

  it('saves a model and effort and returns the updated view', async () => {
    const app = appWith({ claude: fixture('claude-ok'), codex: fixture('codex-app') });
    const res = await request(app)
      .put('/api/ai/providers/codex/selection')
      .set('Host', HOST)
      .send({ model: 'gpt-test-1', effort: 'high' });

    expect(res.status).toBe(200);
    expect(res.body.selection).toEqual({ model: 'gpt-test-1', effort: 'high' });
    const saved = JSON.parse(await readFile(path.join(dir, 'ai.json'), 'utf8')) as {
      selections: { codex: unknown };
    };
    expect(saved.selections.codex).toEqual({ model: 'gpt-test-1', effort: 'high' });
  });

  it('refuses a model or effort the tool does not offer', async () => {
    const app = appWith({ claude: fixture('claude-ok'), codex: fixture('codex-app') });

    const unknownModel = await request(app)
      .put('/api/ai/providers/codex/selection')
      .set('Host', HOST)
      .send({ model: 'gpt-hidden', effort: null });
    expect(unknownModel.status).toBe(400);
    expect(unknownModel.body.error).toMatch(/not a model this tool offers/);

    const unknownEffort = await request(app)
      .put('/api/ai/providers/codex/selection')
      .set('Host', HOST)
      .send({ model: 'gpt-test-1', effort: 'xhigh' });
    expect(unknownEffort.status).toBe(400);
    expect(unknownEffort.body.error).toMatch(/not available/);
  });

  it('rejects an unknown tool name', async () => {
    const app = appWith({ claude: fixture('claude-ok'), codex: fixture('codex-app') });
    const res = await request(app).get('/api/ai/providers/gemini/login').set('Host', HOST);
    expect(res.status).toBe(400);
  });

  it('changes the default tool', async () => {
    const app = appWith({ claude: fixture('claude-ok'), codex: fixture('codex-app') });
    const res = await request(app)
      .put('/api/ai/default')
      .set('Host', HOST)
      .send({ provider: 'codex' });

    expect(res.body.defaultProvider).toBe('codex');
    const status = await request(app).get('/api/ai/providers').set('Host', HOST);
    expect(status.body.defaultProvider).toBe('codex');
  });

  it('starts, reads and cancels a Codex sign-in', async () => {
    const app = appWith({ claude: fixture('claude-ok'), codex: fixture('codex-app') });

    const started = await request(app).post('/api/ai/providers/codex/login').set('Host', HOST);
    expect(started.body.login).toMatchObject({ status: 'pending', code: 'ABCD-1234' });

    const current = await request(app).get('/api/ai/providers/codex/login').set('Host', HOST);
    expect(current.body.login.status).toBe('pending');

    const cancelled = await request(app).delete('/api/ai/providers/codex/login').set('Host', HOST);
    expect(cancelled.body.login.status).toBe('cancelled');
  });

  it('does not accept a pasted code for Codex', async () => {
    const app = appWith({ claude: fixture('claude-ok'), codex: fixture('codex-app') });
    const res = await request(app)
      .post('/api/ai/providers/codex/login/code')
      .set('Host', HOST)
      .send({ code: 'abcd1234' });
    expect(res.status).toBe(502);
  });
});

describe('Claude sign-in through the routes', () => {
  it('shows the sign-in link, forwards the pasted code, and reports success', async () => {
    const app = appWith({ claude: fixture('claude-login'), codex: fixture('codex-app') });

    await request(app).post('/api/ai/providers/claude/login').set('Host', HOST);
    const waiting = (await pollClaudeLogin(app, 'awaiting-code')) as { url: string };
    expect(waiting.url).toMatch(/^https:\/\/claude\.example\.test\//);

    const submitted = await request(app)
      .post('/api/ai/providers/claude/login/code')
      .set('Host', HOST)
      .send({ code: 'test-code#state' });
    expect(submitted.status).toBe(200);

    await pollClaudeLogin(app, 'succeeded');
  });

  it('refuses a code that is not in the expected format', async () => {
    const app = appWith({ claude: fixture('claude-login'), codex: fixture('codex-app') });
    const res = await request(app)
      .post('/api/ai/providers/claude/login/code')
      .set('Host', HOST)
      .send({ code: 'bad code with spaces' });
    expect(res.status).toBe(400);
  });
});
