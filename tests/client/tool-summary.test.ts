import { describe, expect, it } from 'vitest';
import { defaultView, isReady, selectionLabel } from '../../src/client/ai/toolSummary.ts';
import type { ProviderView, ProvidersView } from '../../src/shared/ai-account.ts';

const BASE: ProviderView = {
  id: 'codex',
  label: 'Codex',
  installed: true,
  loggedIn: true,
  detail: '',
  account: null,
  models: [
    { id: 'gpt-a', label: 'GPT A', efforts: ['low', 'high'], defaultEffort: 'low' },
    { id: 'gpt-b', label: 'GPT B', efforts: ['medium'], defaultEffort: null },
  ],
  selection: { model: null, effort: null },
  cliDefault: { model: 'gpt-b', effort: 'medium' },
  canPasteCode: false,
  login: null,
};

describe('selectionLabel', () => {
  it('names the chosen model and effort', () => {
    expect(selectionLabel({ ...BASE, selection: { model: 'gpt-a', effort: 'high' } })).toBe(
      'GPT A · high effort',
    );
  });

  it('falls back to the CLI default when nothing is chosen', () => {
    expect(selectionLabel(BASE)).toBe('GPT B · medium effort');
  });

  it('shows just the model when no effort applies', () => {
    const view = { ...BASE, cliDefault: { model: 'gpt-a', effort: null } };
    expect(selectionLabel(view)).toBe('GPT A');
  });

  it('says so when neither sraww nor the CLI names a model', () => {
    const view = { ...BASE, models: [], cliDefault: { model: null, effort: null } };
    expect(selectionLabel(view)).toBe('CLI default model');
  });
});

describe('defaultView and isReady', () => {
  const data: ProvidersView = {
    defaultProvider: 'codex',
    providers: [{ ...BASE, id: 'claude', label: 'Claude Code' }, BASE],
  };

  it('finds the tool chosen for Generate and Chat', () => {
    expect(defaultView(data)?.id).toBe('codex');
  });

  it('is ready only when installed and signed in', () => {
    expect(isReady(BASE)).toBe(true);
    expect(isReady({ ...BASE, loggedIn: false })).toBe(false);
    expect(isReady({ ...BASE, installed: false })).toBe(false);
    expect(isReady(null)).toBe(false);
  });
});
