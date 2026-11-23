import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { z } from 'zod';
import { AiError } from '../ai-error.ts';
import { parseJsonOutput } from '../parse-output.ts';
import type { AiProvider, ProviderHealth } from '../provider.ts';
import { withHealthCache } from '../provider.ts';
import { runCommand } from '../runner.ts';
import { generateStructured } from '../structured.ts';
import type { ProviderSelection } from '../../../shared/ai-account.ts';

export interface CodexCliOptions {
  bin: string;
  /** Read on every call, so a change in the AI settings applies to the next request. */
  selection?: () => ProviderSelection;
  workdir: string;
  timeoutMs: number;
}

const HEALTH_TIMEOUT_MS = 20_000;
const MAX_OUTPUT_BYTES = 2 * 1024 * 1024;

/** Uses the Codex CLI with the user's ChatGPT Plus login. No API key is involved. */
export function createCodexProvider(options: CodexCliOptions): AiProvider {
  async function health(): Promise<ProviderHealth> {
    try {
      const result = await runCommand({
        command: options.bin,
        args: ['login', 'status'],
        input: '',
        cwd: options.workdir,
        timeoutMs: HEALTH_TIMEOUT_MS,
        maxOutputBytes: MAX_OUTPUT_BYTES,
      });
      const text = `${result.stdout}\n${result.stderr}`;
      const loggedIn =
        result.exitCode === 0 && /logged in/i.test(text) && !/not logged in/i.test(text);
      return {
        id: 'codex',
        installed: true,
        loggedIn,
        detail: loggedIn
          ? 'Codex is logged in.'
          : 'Codex is installed but not logged in. Run `codex login` to sign in.',
      };
    } catch (err) {
      if (err instanceof AiError && err.code === 'NOT_INSTALLED') {
        return { id: 'codex', installed: false, loggedIn: false, detail: err.message };
      }
      return {
        id: 'codex',
        installed: true,
        loggedIn: false,
        detail: 'Could not read Codex login status.',
      };
    }
  }

  async function invoke(prompt: string, jsonSchema: Record<string, unknown>): Promise<unknown> {
    await mkdir(options.workdir, { recursive: true });
    const token = randomUUID();
    const schemaFile = path.join(options.workdir, `schema-${token}.json`);
    const outFile = path.join(options.workdir, `out-${token}.json`);
    try {
      await writeFile(schemaFile, JSON.stringify(jsonSchema), 'utf8');
      const args = [
        'exec',
        '--sandbox',
        'read-only',
        '--ephemeral',
        '--skip-git-repo-check',
        '-C',
        options.workdir,
        '--output-schema',
        schemaFile,
        '-o',
        outFile,
      ];
      const selection = options.selection?.() ?? { model: null, effort: null };
      if (selection.model) args.push('-m', selection.model);
      // The value is parsed as TOML, so the effort is quoted. It was validated against a fixed list.
      if (selection.effort) args.push('-c', `model_reasoning_effort="${selection.effort}"`);
      args.push('-');

      const result = await runCommand({
        command: options.bin,
        args,
        input: prompt,
        cwd: options.workdir,
        timeoutMs: options.timeoutMs,
        maxOutputBytes: MAX_OUTPUT_BYTES,
      });
      if (result.exitCode !== 0) {
        throw new AiError(
          'FAILED',
          `Codex exited with code ${result.exitCode}. Check that it is logged in.`,
        );
      }
      const answer = await readFile(outFile, 'utf8').catch(() => '');
      return parseJsonOutput(answer);
    } finally {
      await Promise.all([rm(schemaFile, { force: true }), rm(outFile, { force: true })]);
    }
  }

  return {
    id: 'codex',
    health: withHealthCache(health),
    generate<T>(prompt: string, schema: z.ZodType<T>): Promise<T> {
      return generateStructured(invoke, prompt, schema);
    },
  };
}
