import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { AiError } from './ai-error.ts';

export interface RunOptions {
  command: string;
  args: readonly string[];
  /** Written to the child's stdin, then stdin is closed. */
  input: string;
  cwd: string;
  timeoutMs: number;
  maxOutputBytes: number;
}

export interface RunResult {
  stdout: string;
  stderr: string;
  exitCode: number | null;
}

const MAX_STDERR_BYTES = 64 * 1024;

/**
 * The only child-process entry point for AI CLIs. No shell is involved, arguments are passed
 * as an array, and the child gets only PATH and HOME, which is all the CLIs need to find their login.
 */
/**
 * Runs a command, creating its working folder first. Without that, a missing folder would be
 * reported as a missing program.
 */
export async function runCommand(options: RunOptions): Promise<RunResult> {
  await mkdir(options.cwd, { recursive: true });
  return runProcess(options);
}

function runProcess(options: RunOptions): Promise<RunResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(options.command, [...options.args], {
      cwd: options.cwd,
      env: { PATH: process.env.PATH ?? '', HOME: process.env.HOME ?? '' },
      shell: false,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';
    let stdoutBytes = 0;
    let stderrBytes = 0;
    let settled = false;
    let abortReason: 'TIMEOUT' | 'OUTPUT_TOO_LARGE' | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;

    function finish(action: () => void): void {
      if (settled) return;
      settled = true;
      if (timer !== null) clearTimeout(timer);
      action();
    }

    function abort(reason: 'TIMEOUT' | 'OUTPUT_TOO_LARGE'): void {
      abortReason ??= reason;
      child.kill('SIGKILL');
    }

    timer = setTimeout(() => abort('TIMEOUT'), options.timeoutMs);

    child.stdout.setEncoding('utf8');
    child.stdout.on('data', (chunk: string) => {
      stdoutBytes += Buffer.byteLength(chunk);
      if (stdoutBytes > options.maxOutputBytes) {
        abort('OUTPUT_TOO_LARGE');
        return;
      }
      stdout += chunk;
    });

    child.stderr.setEncoding('utf8');
    child.stderr.on('data', (chunk: string) => {
      stderrBytes += Buffer.byteLength(chunk);
      if (stderrBytes <= MAX_STDERR_BYTES) stderr += chunk;
    });

    child.on('error', (err: NodeJS.ErrnoException) => {
      finish(() =>
        reject(
          err.code === 'ENOENT'
            ? new AiError('NOT_INSTALLED', `"${options.command}" was not found on PATH.`)
            : new AiError('FAILED', `Could not start "${options.command}": ${err.message}`),
        ),
      );
    });

    child.on('close', (exitCode) => {
      finish(() => {
        if (abortReason === 'TIMEOUT') {
          reject(new AiError('TIMEOUT', 'The AI tool took too long to answer. Try again.'));
        } else if (abortReason === 'OUTPUT_TOO_LARGE') {
          reject(new AiError('OUTPUT_TOO_LARGE', 'The AI tool returned more text than allowed.'));
        } else {
          resolve({ stdout, stderr, exitCode });
        }
      });
    });

    // The child may exit before reading stdin; that write error is expected, not a failure.
    child.stdin.on('error', () => undefined);
    child.stdin.end(options.input);
  });
}
