// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AiAccountPage } from '../../src/client/ai/account/AiAccountPage.tsx';
import { PROVIDERS, json } from './ai-fixtures.ts';

type Handler = () => Response;
const fetchMock = vi.fn();

/** Serves the given "METHOD /path" routes; anything else is a 404. */
function serve(routes: Record<string, Handler>): void {
  fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
    const handler = routes[`${init?.method ?? 'GET'} ${url}`];
    return handler ? handler() : new Response(null, { status: 404 });
  });
}

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  cleanup();
  fetchMock.mockReset();
  vi.unstubAllGlobals();
});

describe('AiAccountPage', () => {
  it('shows the signed-in account, plan and model for the default tool', async () => {
    serve({ 'GET /api/ai/providers': () => json(PROVIDERS) });
    render(<AiAccountPage onBack={() => undefined} />);

    expect(await screen.findByText('Claude subscription')).toBeInTheDocument();
    expect(screen.getByText('person@example.test', { selector: 'dd' })).toBeInTheDocument();
    expect(screen.getByText('Claude subscription')).toBeInTheDocument();
    expect(screen.getByText('Example Org')).toBeInTheDocument();
    expect(screen.getByLabelText('Model')).toHaveValue('opus');
    expect(screen.getByRole('button', { name: 'high' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('keeps Save disabled until a choice changes, then saves the new effort', async () => {
    serve({
      'GET /api/ai/providers': () => json(PROVIDERS),
      'PUT /api/ai/providers/claude/selection': () =>
        json({ ...PROVIDERS.providers[0], selection: { model: 'opus', effort: null } }),
    });
    render(<AiAccountPage onBack={() => undefined} />);
    await screen.findByText('Claude subscription');

    const save = screen.getByRole('button', { name: 'Save model and effort' });
    expect(save).toBeDisabled();

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Default' }));
    expect(save).toBeEnabled();
    await user.click(save);

    await waitFor(() => {
      const put = fetchMock.mock.calls.find(
        (c) => (c[1] as RequestInit | undefined)?.method === 'PUT',
      );
      expect(JSON.parse((put?.[1] as RequestInit).body as string)).toEqual({
        model: 'opus',
        effort: null,
      });
    });
    expect(await screen.findByText('Saved.')).toBeInTheDocument();
  });

  it('shows the device code and link for a Codex sign-in', async () => {
    serve({
      'GET /api/ai/providers': () => json(PROVIDERS),
      'POST /api/ai/providers/codex/login': () =>
        json({
          login: {
            provider: 'codex',
            status: 'pending',
            url: 'https://auth.openai.com/codex/device',
            code: 'ABCD-1234',
            message: null,
          },
        }),
    });
    render(<AiAccountPage onBack={() => undefined} />);
    await screen.findByText('Claude subscription');

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /^Codex/ }));
    await user.click(await screen.findByRole('button', { name: 'Sign in' }));

    expect(await screen.findByText('ABCD-1234')).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'https://auth.openai.com/codex/device' }),
    ).toHaveAttribute('href', 'https://auth.openai.com/codex/device');
    expect(screen.getByRole('button', { name: 'Cancel sign-in' })).toBeInTheDocument();
  });

  it('asks for the pasted code once Claude has shown its sign-in link', async () => {
    const waiting = {
      ...PROVIDERS.providers[0],
      login: {
        provider: 'claude',
        status: 'awaiting-code',
        url: 'https://claude.com/cai/oauth/authorize?state=abc',
        code: null,
        message: null,
      },
    };
    serve({
      'GET /api/ai/providers': () =>
        json({ ...PROVIDERS, providers: [waiting, PROVIDERS.providers[1]] }),
      'POST /api/ai/providers/claude/login/code': () =>
        json({ login: { ...waiting.login, status: 'pending' } }),
    });
    render(<AiAccountPage onBack={() => undefined} />);

    const input = await screen.findByLabelText('Sign-in code');
    const user = userEvent.setup();
    await user.type(input, 'test-code#state');
    await user.click(screen.getByRole('button', { name: 'Submit code' }));

    await waitFor(() => {
      const post = fetchMock.mock.calls.find(
        (c) => (c[0] as string) === '/api/ai/providers/claude/login/code',
      );
      expect(JSON.parse((post?.[1] as RequestInit).body as string)).toEqual({
        code: 'test-code#state',
      });
    });
  });

  it('lists the tools and marks the default one', async () => {
    serve({ 'GET /api/ai/providers': () => json(PROVIDERS) });
    render(<AiAccountPage onBack={() => undefined} />);
    await screen.findByText('Claude subscription');

    const claude = screen.getByRole('button', { name: /^Claude Code/ });
    expect(claude).toHaveTextContent('Default');
    expect(screen.getByRole('button', { name: /^Codex/ })).toHaveTextContent('Not signed in');
  });
});
