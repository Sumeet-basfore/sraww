import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import readline from 'node:readline';
import { AiError } from '../ai-error.ts';

// A small JSON-RPC client for `codex app-server`. The server runs as one long-lived process so a
// device-code sign-in started by one request is still alive when its completion arrives later.

export interface AppServerNotification {
  method: string;
  params: unknown;
}

export interface CodexAppServer {
  request<T = unknown>(method: string, params?: unknown): Promise<T>;
  onNotification(listener: (note: AppServerNotification) => void): void;
  close(): void;
}

interface Pending {
  resolve: (value: unknown) => void;
  reject: (err: Error) => void;
}

const CALL_TIMEOUT_MS = 20_000;
const MAX_LINE_CHARS = 4 * 1024 * 1024;
const METHOD_NOT_FOUND = -32601;

export function createCodexAppServer(options: {
  bin: string;
  cwd: string;
  env: NodeJS.ProcessEnv;
}): CodexAppServer {
  let child: ChildProcessWithoutNullStreams | null = null;
  let ready: Promise<void> | null = null;
  let nextId = 1;
  const pending = new Map<number, Pending & { timer: NodeJS.Timeout }>();
  const listeners: Array<(note: AppServerNotification) => void> = [];

  function failAll(err: AiError): void {
    for (const [id, call] of pending) {
      clearTimeout(call.timer);
      call.reject(err);
      pending.delete(id);
    }
  }

  function send(proc: ChildProcessWithoutNullStreams, message: object): void {
    proc.stdin.write(`${JSON.stringify(message)}\n`);
  }

  function handleLine(proc: ChildProcessWithoutNullStreams, line: string): void {
    if (line.length > MAX_LINE_CHARS) return;
    let message: unknown;
    try {
      message = JSON.parse(line);
    } catch {
      return;
    }
    if (typeof message !== 'object' || message === null) return;
    const record = message as Record<string, unknown>;
    const id = record.id;
    const method = record.method;

    if (typeof id === 'number' && (record.result !== undefined || record.error !== undefined)) {
      const call = pending.get(id);
      if (!call) return;
      clearTimeout(call.timer);
      pending.delete(id);
      const error = record.error as { message?: unknown } | undefined;
      if (error) {
        const text = typeof error.message === 'string' ? error.message : 'unknown error';
        call.reject(new AiError('FAILED', `Codex reported an error: ${text.slice(0, 300)}`));
      } else {
        call.resolve(record.result);
      }
      return;
    }

    if (typeof method === 'string' && id !== undefined) {
      // A request from the server that sraww does not handle. Refuse it so nothing waits forever.
      send(proc, {
        jsonrpc: '2.0',
        id,
        error: { code: METHOD_NOT_FOUND, message: 'Not supported by sraww.' },
      });
      return;
    }

    if (typeof method === 'string') {
      const note = { method, params: record.params };
      for (const listener of listeners) listener(note);
    }
  }

  function sendRequest<T>(
    proc: ChildProcessWithoutNullStreams,
    method: string,
    params: unknown,
  ): Promise<T> {
    const id = nextId;
    nextId += 1;
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        pending.delete(id);
        reject(new AiError('TIMEOUT', `Codex did not answer ${method} in time.`));
      }, CALL_TIMEOUT_MS);
      pending.set(id, {
        timer,
        resolve: (value) => resolve(value as T),
        reject,
      });
      send(proc, { jsonrpc: '2.0', id, method, params });
    });
  }

  function start(): Promise<void> {
    if (ready) return ready;
    // The working folder may not exist yet on a fresh install; spawning in a missing folder fails.
    ready = mkdir(options.cwd, { recursive: true })
      .then(() => launch())
      .catch((err: unknown) => {
        ready = null;
        throw err instanceof Error ? err : new AiError('FAILED', 'Codex did not start.');
      });
    return ready;
  }

  function launch(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const proc = spawn(options.bin, ['app-server'], {
        cwd: options.cwd,
        env: options.env,
        shell: false,
        stdio: ['pipe', 'pipe', 'pipe'],
      });
      child = proc;
      let started = false;

      proc.on('error', (err) => {
        const missing = (err as NodeJS.ErrnoException).code === 'ENOENT';
        const failure = missing
          ? new AiError(
              'NOT_INSTALLED',
              `${options.bin} was not found. Install Codex or set CODEX_BIN.`,
            )
          : new AiError('FAILED', 'Could not start Codex.');
        if (child === proc) child = null;
        ready = null;
        failAll(failure);
        if (!started) reject(failure);
      });
      proc.on('exit', () => {
        if (child === proc) child = null;
        ready = null;
        failAll(new AiError('FAILED', 'Codex stopped unexpectedly. Try again.'));
        if (!started) reject(new AiError('FAILED', 'Codex stopped before it was ready.'));
      });

      readline.createInterface({ input: proc.stdout }).on('line', (line) => handleLine(proc, line));
      proc.stderr.resume();
      // If the process dies while a request is being written, the write error is handled
      // by the exit handler above. Without this listener it would crash the server.
      proc.stdin.on('error', () => undefined);

      sendRequest(proc, 'initialize', {
        clientInfo: { name: 'sraww', title: 'sraww', version: '0.1.0' },
        capabilities: { experimentalApi: true },
      })
        .then(() => {
          send(proc, { jsonrpc: '2.0', method: 'initialized' });
          started = true;
          resolve();
        })
        .catch((err: unknown) => {
          ready = null;
          proc.kill('SIGKILL');
          reject(err instanceof Error ? err : new AiError('FAILED', 'Codex did not start.'));
        });
    });
  }

  return {
    async request<T>(method: string, params: unknown = {}): Promise<T> {
      await start();
      const proc = child;
      if (!proc) throw new AiError('FAILED', 'Codex is not running.');
      return sendRequest<T>(proc, method, params);
    },
    onNotification(listener) {
      listeners.push(listener);
    },
    close() {
      const proc = child;
      child = null;
      ready = null;
      failAll(new AiError('FAILED', 'Codex was closed.'));
      proc?.kill('SIGKILL');
    },
  };
}
