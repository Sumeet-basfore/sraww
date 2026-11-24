import { mkdir } from 'node:fs/promises';
import type { z } from 'zod';
import { AiError } from '../ai-error.ts';
import { parseJsonOutput, isRecord } from '../parse-output.ts';
import type { AiProvider, GenerateOptions, ProviderHealth } from '../provider.ts';
import { withHealthCache } from '../provider.ts';
import { runCommand } from '../runner.ts';
import { generateStructured } from '../structured.ts';
import type { ProviderSelection } from '../../../shared/ai-account.ts';

export interface ClaudeCliOptions {
  bin: string;
  /** Read on every call, so a change in the AI settings applies to the next request. */
  selection?: () => ProviderSelection;
  workdir: string;
  timeoutMs: number;
}

const HEALTH_TIMEOUT_MS = 20_000;
/** The only tools a web-enabled call may use: search and reading a page. */
const WEB_TOOLS = 'WebSearch,WebFetch';
const MAX_OUTPUT_BYTES = 2 * 1024 * 1024;

/** Uses the Claude Code CLI with the user's Claude Pro login. No API key is involved. */
export function createClaudeProvider(options: ClaudeCliOptions): AiProvider {
  async function health(): Promise<ProviderHealth> {
    try {
      const result = await runCommand({
        command: options.bin,
        args: ['auth', 'status'],
        input: '',
        cwd: options.workdir,
        timeoutMs: HEALTH_TIMEOUT_MS,
        maxOutputBytes: MAX_OUTPUT_BYTES,
      });
      const parsed = parseJsonOutput(result.stdout);
      const loggedIn = isRecord(parsed) && parsed.loggedIn === true;
      return {
        id: 'claude',
        installed: true,
        loggedIn,
        detail: loggedIn
          ? 'Claude Code is logged in.'
          : 'Claude Code is installed but not logged in. Run `claude` once to sign in.',
      };
    } catch (err) {
      if (err instanceof AiError && err.code === 'NOT_INSTALLED') {
        return { id: 'claude', installed: false, loggedIn: false, detail: err.message };
      }
      return {
        id: 'claude',
        installed: true,
        loggedIn: false,
        detail: 'Could not read Claude Code login status.',
      };
    }
  }

  async function invoke(
    prompt: string,
    jsonSchema: Record<string, unknown>,
    callOptions?: GenerateOptions,
  ): Promise<unknown> {
    await mkdir(options.workdir, { recursive: true });
    // Without web search, no built-in tools are offered at all.
    const toolArgs = callOptions?.webSearch
      ? ['--tools', WEB_TOOLS, '--allowedTools', WEB_TOOLS]
      : ['--tools', ''];
    const args = [
      '-p',
      '--output-format',
      'json',
      '--json-schema',
      JSON.stringify(jsonSchema),
      ...toolArgs,
    ];
    const selection = options.selection?.() ?? { model: null, effort: null };
    if (selection.model) args.push('--model', selection.model);
    if (selection.effort) args.push('--effort', selection.effort);

    const result = await runCommand({
      command: options.bin,
      args,
      input: prompt,
      cwd: options.workdir,
      timeoutMs: options.timeoutMs,
      maxOutputBytes: MAX_OUTPUT_BYTES,
    });
    const envelope = parseJsonOutput(result.stdout);
    if (!isRecord(envelope))
      throw new AiError('FAILED', 'Claude Code returned an unexpected reply.');
    if (envelope.is_error === true || envelope.subtype !== 'success') {
      const reason = typeof envelope.result === 'string' ? envelope.result : 'unknown error';
      throw new AiError('FAILED', `Claude Code reported an error: ${reason.slice(0, 300)}`);
    }
    return envelope.structured_output;
  }

  return {
    id: 'claude',
    health: withHealthCache(health),
    generate<T>(prompt: string, schema: z.ZodType<T>, callOptions?: GenerateOptions): Promise<T> {
      return generateStructured(invoke, prompt, schema, callOptions);
    },
  };
}
