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
  workdir = await mkdtemp(path.join(os.tmpdir(), 'sraww-args-'));
});

afterEach(async () => {
  await rm(workdir, { recursive: true, force: true });
});

/** The fixture writes the arguments it was started with into the working folder. */
async function recordedArgs(): Promise<string[]> {
  return JSON.parse(await readFile(path.join(workdir, 'args.json'), 'utf8')) as string[];
}

describe('CLI arguments follow the chosen model and effort', () => {
  it('passes the Claude model and effort as flags', async () => {
    const provider = createClaudeProvider({
      bin: fixture('claude-args'),
      workdir,
      timeoutMs: 10_000,
      selection: () => ({ model: 'opus', effort: 'high' }),
    });
    await provider.generate('draw', diagramGraphSchema);
    const args = await recordedArgs();
    expect(args).toEqual(expect.arrayContaining(['--model', 'opus', '--effort', 'high']));
  });

  it('leaves out Claude model and effort flags when nothing is chosen', async () => {
    const provider = createClaudeProvider({
      bin: fixture('claude-args'),
      workdir,
      timeoutMs: 10_000,
      selection: () => ({ model: null, effort: null }),
    });
    await provider.generate('draw', diagramGraphSchema);
    const args = await recordedArgs();
    expect(args).not.toContain('--model');
    expect(args).not.toContain('--effort');
  });

  it('passes the Codex model with -m and the effort as a quoted config value', async () => {
    const provider = createCodexProvider({
      bin: fixture('codex-args'),
      workdir,
      timeoutMs: 10_000,
      selection: () => ({ model: 'gpt-test-1', effort: 'high' }),
    });
    await provider.generate('draw', diagramGraphSchema);
    const args = await recordedArgs();
    expect(args).toEqual(expect.arrayContaining(['-m', 'gpt-test-1']));
    expect(args).toEqual(expect.arrayContaining(['-c', 'model_reasoning_effort="high"']));
    expect(args[args.length - 1]).toBe('-');
  });
});
