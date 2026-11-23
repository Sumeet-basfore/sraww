import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AiError } from '../../src/server/ai/ai-error.ts';
import { createClaudeAccount } from '../../src/server/ai/account/claude-account.ts';
import { createClaudeLogin } from '../../src/server/ai/account/claude-login.ts';
import { waitFor } from '../fixtures/wait.ts';

const fixture = (name: string): string => path.resolve('tests/fixtures/bin', name);
const env = { PATH: process.env.PATH ?? '', HOME: process.env.HOME ?? '' };
const NO_SELECTION = { model: null, effort: null };
let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(path.join(os.tmpdir(), 'sraww-claude-account-'));
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

function accountWith(bin: string, loginBin = fixture('claude-login')) {
  return createClaudeAccount({
    bin,
    workdir: dir,
    selection: () => NO_SELECTION,
    login: createClaudeLogin({ bin: loginBin, env }),
  });
}

describe('claude account', () => {
  it('reads the signed-in identity from `claude auth status`', async () => {
    const view = await accountWith(fixture('claude-ok')).view();
    expect(view).toMatchObject({
      id: 'claude',
      installed: true,
      loggedIn: true,
      canPasteCode: true,
      account: {
        email: 'person@example.test',
        organization: 'Example Org',
        method: 'Claude subscription',
      },
    });
    expect(view.models.map((m) => m.id)).toEqual(['sonnet', 'opus', 'fable']);
  });

  it('reports signed out when the CLI says so', async () => {
    const view = await accountWith(fixture('claude-logged-out')).view();
    expect(view).toMatchObject({ installed: true, loggedIn: false, account: null });
  });

  it('reports a missing install with a helpful message', async () => {
    const view = await accountWith('definitely-not-a-real-claude').view();
    expect(view).toMatchObject({ installed: false, loggedIn: false });
    expect(view.detail).toMatch(/not installed/);
  });
});

describe('claude sign-in', () => {
  it('shows the sign-in link, then completes once the pasted code is accepted', async () => {
    const login = createClaudeLogin({ bin: fixture('claude-login'), env });
    const started = login.start();
    expect(started.status).toBe('pending');

    await waitFor(() => login.current()?.status === 'awaiting-code');
    expect(login.current()?.url).toBe('https://claude.example.test/oauth/authorize?state=abc');

    login.submitCode('test-code#state');
    await waitFor(() => login.current()?.status === 'succeeded');
  });

  it('reports the failure when the pasted code is rejected', async () => {
    const login = createClaudeLogin({ bin: fixture('claude-login'), env });
    login.start();
    await waitFor(() => login.current()?.status === 'awaiting-code');

    login.submitCode('wrong-code');
    await waitFor(() => login.current()?.status === 'failed');
    expect(login.current()?.message).toBe('Invalid code. Please try again.');
  });

  it('can be cancelled while it waits', async () => {
    const login = createClaudeLogin({ bin: fixture('claude-login-slow'), env });
    login.start();
    await waitFor(() => login.current()?.status === 'awaiting-code');

    expect(login.cancel()?.status).toBe('cancelled');
  });

  it('refuses a code when no sign-in is waiting for one', () => {
    const login = createClaudeLogin({ bin: fixture('claude-login'), env });
    expect(() => login.submitCode('test-code')).toThrow(AiError);
  });
});
