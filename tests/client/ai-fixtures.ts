import type { ProvidersView } from '../../src/shared/ai-account.ts';

/** Two tools as the server reports them: Claude signed in on Opus, Codex signed out. */
export const PROVIDERS: ProvidersView = {
  defaultProvider: 'claude',
  providers: [
    {
      id: 'claude',
      label: 'Claude Code',
      installed: true,
      loggedIn: true,
      detail: 'Signed in as person@example.test.',
      account: {
        email: 'person@example.test',
        plan: null,
        organization: 'Example Org',
        method: 'Claude subscription',
      },
      models: [{ id: 'opus', label: 'Opus', efforts: ['low', 'high'], defaultEffort: null }],
      selection: { model: 'opus', effort: 'high' },
      cliDefault: { model: null, effort: null },
      canPasteCode: true,
      login: null,
    },
    {
      id: 'codex',
      label: 'Codex',
      installed: true,
      loggedIn: false,
      detail: 'Not signed in. Sign in with your ChatGPT account to use Codex.',
      account: null,
      models: [],
      selection: { model: null, effort: null },
      cliDefault: { model: null, effort: null },
      canPasteCode: false,
      login: null,
    },
  ],
};

export function json(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}
