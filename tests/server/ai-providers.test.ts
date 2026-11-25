import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createClaudeProvider } from '../../src/server/ai/providers/claude-cli.ts';
import { createCodexProvider } from '../../src/server/ai/providers/codex-cli.ts';
import { AiError } from '../../src/server/ai/ai-error.ts';
import { diagramGraphSchema } from '../../src/shared/ai-schemas.ts';
import { moduleQuizReplySchema } from '../../src/shared/learn.ts';

const fixture = (name: string): string => path.resolve('tests/fixtures/bin', name);
let workdir: string;

beforeEach(async () => {
  workdir = await mkdtemp(path.join(os.tmpdir(), 'sraww-ai-'));
});

afterEach(async () => {
  await rm(workdir, { recursive: true, force: true });
});

function claude(bin: string, timeoutMs = 10_000) {
  return createClaudeProvider({ bin, workdir, timeoutMs });
}

function codex(bin: string, timeoutMs = 10_000) {
  return createCodexProvider({ bin, workdir, timeoutMs });
}

describe('claude provider', () => {
  it('returns a validated graph from the structured output', async () => {
    const graph = await claude(fixture('claude-ok')).generate('draw', diagramGraphSchema);
    expect(graph.nodes.map((n) => n.id)).toEqual(['api', 'db']);
  });

  it('turns off every Claude tool when a call requires tool-free generation', async () => {
    await claude(fixture('claude-args')).generate('build quiz', diagramGraphSchema, {
      disableTools: true,
      webSearch: false,
    });

    const args = JSON.parse(await readFile(path.join(workdir, 'args.json'), 'utf8')) as string[];
    const toolsIndex = args.indexOf('--tools');
    expect(args[toolsIndex + 1]).toBe('');
    expect(args).not.toContain('WebSearch');
    expect(args).not.toContain('WebFetch');
  });

  it('reports the login state from `claude auth status`', async () => {
    const health = await claude(fixture('claude-ok')).health();
    expect(health).toMatchObject({ id: 'claude', installed: true, loggedIn: true });
  });

  it('reports a logged-out CLI with a helpful message', async () => {
    const health = await claude(fixture('claude-logged-out')).health();
    expect(health.loggedIn).toBe(false);
    expect(health.detail).toMatch(/not logged in/);
  });

  it('reports a missing CLI as not installed', async () => {
    const health = await claude(path.join(workdir, 'no-such-claude')).health();
    expect(health).toMatchObject({ installed: false, loggedIn: false });
  });

  it('surfaces a CLI-reported error such as a usage limit', async () => {
    const error = await claude(fixture('claude-error'))
      .generate('draw', diagramGraphSchema)
      .catch((e: unknown) => e);
    expect(error).toMatchObject({ code: 'FAILED' });
    expect((error as Error).message).toMatch(/Usage limit reached/);
  });

  it('gives INVALID_OUTPUT when the structured answer never matches', async () => {
    const error = await claude(fixture('claude-invalid'))
      .generate('draw', diagramGraphSchema)
      .catch((e: unknown) => e);
    expect(error).toMatchObject({ code: 'INVALID_OUTPUT' });
  });

  it('times out a CLI that hangs', async () => {
    const error = await claude(fixture('claude-slow'), 400)
      .generate('draw', diagramGraphSchema)
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(AiError);
    expect(error).toMatchObject({ code: 'TIMEOUT' });
  });

  it('stops a CLI that floods stdout', async () => {
    const error = await claude(fixture('claude-huge'))
      .generate('draw', diagramGraphSchema)
      .catch((e: unknown) => e);
    expect(error).toMatchObject({ code: 'OUTPUT_TOO_LARGE' });
  });
});

describe('codex provider', () => {
  it('reads the answer from the output file', async () => {
    const graph = await codex(fixture('codex-ok')).generate('draw', diagramGraphSchema);
    expect(graph.edges).toEqual([{ from: 'api', to: 'db', label: 'reads' }]);
  });

  it('removes its temporary schema and output files afterwards', async () => {
    const { readdir } = await import('node:fs/promises');
    await codex(fixture('codex-ok')).generate('draw', diagramGraphSchema);
    expect(await readdir(workdir)).toEqual([]);
  });

  it('reports the ChatGPT login state', async () => {
    expect(await codex(fixture('codex-ok')).health()).toMatchObject({ loggedIn: true });
    expect(await codex(fixture('codex-logged-out')).health()).toMatchObject({ loggedIn: false });
  });

  it('fails clearly when codex exits with an error', async () => {
    const error = await codex(fixture('codex-error'))
      .generate('draw', diagramGraphSchema)
      .catch((e: unknown) => e);
    expect(error).toMatchObject({ code: 'FAILED' });
  });

  it('refuses a request that requires all tools to be disabled', async () => {
    const error = await codex(path.join(workdir, 'no-such-codex'))
      .generate('build quiz', moduleQuizReplySchema, { disableTools: true, webSearch: false })
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(AiError);
    expect(error).toMatchObject({ code: 'FAILED' });
    expect((error as Error).message).toMatch(/keeps its command tool available/);
  });

  it('gives INVALID_OUTPUT when the output file is the wrong shape', async () => {
    const error = await codex(fixture('codex-invalid'))
      .generate('draw', diagramGraphSchema)
      .catch((e: unknown) => e);
    expect(error).toMatchObject({ code: 'INVALID_OUTPUT' });
  });

  it('times out a hung codex', async () => {
    const error = await codex(fixture('codex-slow'), 400)
      .generate('draw', diagramGraphSchema)
      .catch((e: unknown) => e);
    expect(error).toMatchObject({ code: 'TIMEOUT' });
  });
});
