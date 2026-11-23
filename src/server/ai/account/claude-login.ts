import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { AiError } from '../ai-error.ts';
import { isTerminal, type LoginFlow } from '../../../shared/ai-account.ts';

const URL_PATTERN = /https:\/\/[^\s"'<>]+/;
const LOGIN_TIMEOUT_MS = 5 * 60_000;
const MAX_OUTPUT_CHARS = 16 * 1024;

interface ActiveLogin {
  child: ChildProcessWithoutNullStreams;
  flow: LoginFlow;
  output: string;
  /** Only the error stream, so a failure message is not mixed with the CLI's prompts. */
  errors: string;
  timer: NodeJS.Timeout;
}

export interface ClaudeLogin {
  current(): LoginFlow | null;
  start(): LoginFlow;
  submitCode(code: string): LoginFlow;
  cancel(): LoginFlow | null;
}

function lastLine(text: string): string {
  const lines = text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  return lines[lines.length - 1] ?? '';
}

/**
 * Runs `claude auth login` and keeps it open until the user finishes in the browser. The CLI
 * prints a link, then asks for a code; sraww shows the link and forwards the code. sraww never
 * sees the password or the token.
 */
export function createClaudeLogin(options: { bin: string; env: NodeJS.ProcessEnv }): ClaudeLogin {
  let active: ActiveLogin | null = null;

  function update(patch: Partial<LoginFlow>): LoginFlow {
    if (!active) throw new AiError('FAILED', 'No sign-in is in progress.');
    active = { ...active, flow: { ...active.flow, ...patch } };
    return active.flow;
  }

  function finish(status: LoginFlow['status'], message: string | null): void {
    if (!active) return;
    clearTimeout(active.timer);
    update({ status, message });
  }

  function start(): LoginFlow {
    if (active && (active.flow.status === 'pending' || active.flow.status === 'awaiting-code')) {
      return active.flow;
    }
    const child = spawn(options.bin, ['auth', 'login', '--claudeai'], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: options.env,
      shell: false,
    });
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      finish('failed', 'Sign-in timed out. Start it again.');
    }, LOGIN_TIMEOUT_MS);
    active = {
      child,
      timer,
      output: '',
      errors: '',
      flow: {
        provider: 'claude',
        status: 'pending',
        url: null,
        code: null,
        message: null,
      },
    };

    const onOutput = (chunk: Buffer): void => {
      if (!active || active.child !== child) return;
      active.output = `${active.output}${chunk.toString('utf8')}`.slice(-MAX_OUTPUT_CHARS);
      const match = URL_PATTERN.exec(active.output);
      if (match && !active.flow.url) {
        update({ url: match[0], status: 'awaiting-code' });
      }
    };
    child.stdout.on('data', onOutput);
    child.stderr.on('data', (chunk: Buffer) => {
      if (!active || active.child !== child) return;
      active.errors = `${active.errors}${chunk.toString('utf8')}`.slice(-MAX_OUTPUT_CHARS);
      onOutput(chunk);
    });
    child.on('error', (err) => {
      if (active?.child !== child) return;
      const missing = (err as NodeJS.ErrnoException).code === 'ENOENT';
      finish(
        'failed',
        missing ? 'Claude Code is not installed.' : 'Could not start the Claude Code sign-in.',
      );
    });
    child.stdin.on('error', () => undefined);
    child.on('exit', (code) => {
      if (active?.child !== child) return;
      // A timeout or cancel has already set the final status; keep its message.
      if (isTerminal(active.flow.status)) return;
      if (code === 0) {
        finish('succeeded', null);
      } else {
        finish(
          'failed',
          lastLine(active.errors) || lastLine(active.output) || 'Sign-in did not finish.',
        );
      }
    });
    return active.flow;
  }

  function submitCode(code: string): LoginFlow {
    if (!active || active.flow.status !== 'awaiting-code') {
      throw new AiError('FAILED', 'No sign-in is waiting for a code.');
    }
    active.child.stdin.write(`${code}\n`);
    return update({ status: 'pending', message: null });
  }

  function cancel(): LoginFlow | null {
    if (!active) return null;
    if (active.flow.status === 'pending' || active.flow.status === 'awaiting-code') {
      active.child.kill('SIGKILL');
      finish('cancelled', null);
    }
    return active.flow;
  }

  return {
    current: () => active?.flow ?? null,
    start,
    submitCode,
    cancel,
  };
}
