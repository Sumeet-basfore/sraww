import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createClaudeProvider } from '../../src/server/ai/providers/claude-cli.ts';
import { createCodexProvider } from '../../src/server/ai/providers/codex-cli.ts';
import { diagramGraphSchema } from '../../src/shared/ai-schemas.ts';

const fixture = (name: string): string => path.resolve('tests/fixtures/bin', name);
let workdir: string;

beforeEach(async () => {
  workdir = await mkdtemp(path.join(os.tmpdir(), 'sraww-web-args-'));
});

afterEach(async () => {
  await rm(workdir, { recursive: true, force: true });
});

/** The fixture writes the arguments it was started with into the working folder. */
async function recordedArgs(): Promise<string[]> {
  return JSON.parse(await readFile(path.join(workdir, 'args.json'), 'utf8')) as string[];
}

/** Returns the values that follow a flag, so tests can compare exact tool lists. */
function valueAfter(args: string[], flag: string): string | undefined {
  const index = args.indexOf(flag);
  return index === -1 ? undefined : args[index + 1];
}

describe('web search is opt-in per call', () => {
  it('offers Claude only its search and page-reading tools when web search is on', async () => {
    const provider = createClaudeProvider({
      bin: fixture('claude-args'),
      workdir,
      timeoutMs: 10_000,
      selection: () => ({ model: null, effort: null }),
    });
    await provider.generate('learn', diagramGraphSchema, { webSearch: true });
    const args = await recordedArgs();
    expect(valueAfter(args, '--tools')).toBe('WebSearch,WebFetch');
    expect(valueAfter(args, '--allowedTools')).toBe('WebSearch,WebFetch');
  });

  it('keeps Claude tools off for ordinary calls', async () => {
    const provider = createClaudeProvider({
      bin: fixture('claude-args'),
      workdir,
      timeoutMs: 10_000,
      selection: () => ({ model: null, effort: null }),
    });
    await provider.generate('draw', diagramGraphSchema);
    const args = await recordedArgs();
    expect(valueAfter(args, '--tools')).toBe('');
    expect(args).not.toContain('--allowedTools');
  });

  it('puts Codex search before the exec subcommand and keeps the read-only sandbox', async () => {
    const provider = createCodexProvider({
      bin: fixture('codex-args'),
      workdir,
      timeoutMs: 10_000,
      selection: () => ({ model: null, effort: null }),
    });
    await provider.generate('learn', diagramGraphSchema, { webSearch: true });
    const args = await recordedArgs();
    expect(args[0]).toBe('--search');
    expect(args[1]).toBe('exec');
    expect(valueAfter(args, '--sandbox')).toBe('read-only');
  });

  it('does not add Codex search to ordinary calls', async () => {
    const provider = createCodexProvider({
      bin: fixture('codex-args'),
      workdir,
      timeoutMs: 10_000,
      selection: () => ({ model: null, effort: null }),
    });
    await provider.generate('draw', diagramGraphSchema);
    const args = await recordedArgs();
    expect(args).not.toContain('--search');
    expect(args[0]).toBe('exec');
  });
});
