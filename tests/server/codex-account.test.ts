import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AiError } from '../../src/server/ai/ai-error.ts';
import { createCodexAccount } from '../../src/server/ai/account/codex-account.ts';
import {
  createCodexAppServer,
  type CodexAppServer,
} from '../../src/server/ai/account/codex-app-server.ts';
import { waitFor } from '../fixtures/wait.ts';

const fixture = (name: string): string => path.resolve('tests/fixtures/bin', name);
const NO_SELECTION = { model: null, effort: null };
let dir: string;
let servers: CodexAppServer[];

beforeEach(async () => {
  dir = await mkdtemp(path.join(os.tmpdir(), 'sraww-codex-account-'));
  servers = [];
});

afterEach(async () => {
  servers.forEach((server) => server.close());
  await rm(dir, { recursive: true, force: true });
});

function accountWith(bin: string) {
  const server = createCodexAppServer({
    bin,
    cwd: dir,
    env: { PATH: process.env.PATH ?? '', HOME: process.env.HOME ?? '' },
  });
  servers.push(server);
  return createCodexAccount({ server, selection: () => NO_SELECTION });
}

describe('codex account', () => {
  it('reads the signed-in account, its plan and the CLI default model', async () => {
    const view = await accountWith(fixture('codex-app')).view();

    expect(view).toMatchObject({
      id: 'codex',
      installed: true,
      loggedIn: true,
      canPasteCode: false,
      account: { email: 'person@example.test', plan: 'Plus', method: 'ChatGPT' },
      cliDefault: { model: 'gpt-test-1', effort: 'high' },
    });
  });

  it('lists only the models that are not hidden, with their efforts', async () => {
    const models = await accountWith(fixture('codex-app')).models();
    expect(models).toEqual([
      {
        id: 'gpt-test-1',
        label: 'Test One',
        efforts: ['low', 'high'],
        defaultEffort: 'low',
      },
    ]);
  });

  it('reports signed out when there is no account', async () => {
    const view = await accountWith(fixture('codex-app-signed-out')).view();
    expect(view).toMatchObject({ installed: true, loggedIn: false, account: null });
  });

  it('reports a missing install with a helpful message', async () => {
    const view = await accountWith('definitely-not-a-real-codex').view();
    expect(view).toMatchObject({ installed: false, loggedIn: false, models: [] });
    expect(view.detail).toMatch(/not installed/);
  });

  it('starts a device-code sign-in and can cancel it', async () => {
    const account = accountWith(fixture('codex-app'));
    const flow = await account.startLogin();
    expect(flow).toMatchObject({
      provider: 'codex',
      status: 'pending',
      url: 'https://auth.example.test/device',
      code: 'ABCD-1234',
    });

    const cancelled = await account.cancelLogin();
    expect(cancelled?.status).toBe('cancelled');
  });

  it('marks the sign-in succeeded when the app server reports completion', async () => {
    const account = accountWith(fixture('codex-app-autocomplete'));
    await account.startLogin();
    await waitFor(() => account.currentLogin()?.status === 'succeeded');
    expect(account.currentLogin()).toMatchObject({ status: 'succeeded', code: null });
  });

  it('refuses a pasted code, because Codex signs in on its own page', async () => {
    const account = accountWith(fixture('codex-app'));
    await expect(account.submitLoginCode('anything')).rejects.toBeInstanceOf(AiError);
  });
});
