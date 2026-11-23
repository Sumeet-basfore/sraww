import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  createCodexAppServer,
  type CodexAppServer,
} from '../../src/server/ai/account/codex-app-server.ts';

const fixture = (name: string): string => path.resolve('tests/fixtures/bin', name);
const env = { PATH: process.env.PATH ?? '', HOME: process.env.HOME ?? '' };
let dir: string;
let servers: CodexAppServer[];

beforeEach(async () => {
  dir = await mkdtemp(path.join(os.tmpdir(), 'sraww-app-server-'));
  servers = [];
});

afterEach(async () => {
  servers.forEach((server) => server.close());
  await rm(dir, { recursive: true, force: true });
});

function serverFor(bin: string): CodexAppServer {
  const server = createCodexAppServer({ bin, cwd: dir, env });
  servers.push(server);
  return server;
}

describe('codex app server client', () => {
  it('answers a request after the initialize handshake', async () => {
    const server = serverFor(fixture('codex-app'));
    const result = await server.request<{ account: { email: string } }>('account/read', {
      refreshToken: false,
    });
    expect(result.account.email).toBe('person@example.test');
  });

  it('reports a missing binary as not installed', async () => {
    const server = serverFor('definitely-not-a-real-codex');
    await expect(server.request('account/read')).rejects.toMatchObject({
      code: 'NOT_INSTALLED',
    });
  });

  it('turns a JSON-RPC error into a readable error', async () => {
    const server = serverFor(fixture('codex-app'));
    await expect(server.request('no/such/method')).rejects.toThrow(/unknown method/);
  });

  it('passes server notifications to its listeners', async () => {
    const server = serverFor(fixture('codex-app-autocomplete'));
    const received = new Promise<{ method: string; params: unknown }>((resolve) => {
      server.onNotification((note) => {
        if (note.method === 'account/login/completed') resolve(note);
      });
    });
    await server.request('account/login/start', { type: 'chatgptDeviceCode' });
    await expect(received).resolves.toMatchObject({
      method: 'account/login/completed',
      params: { loginId: 'login-1', success: true },
    });
  });
});
