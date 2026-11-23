import { useState } from 'react';
import { aiApi } from '../../lib/api.ts';
import { errorMessage } from '../../lib/errors.ts';
import type { ProviderId, ProviderSelection, ProviderView } from '../../../shared/ai-account.ts';
import { useAiProviders } from '../useAiProviders.ts';
import { AccountCard } from './AccountCard.tsx';
import { ModelControls } from './ModelControls.tsx';
import { SignInSection } from './SignInSection.tsx';

interface AiAccountPageProps {
  onBack: () => void;
}

function toolStatus(view: ProviderView): string {
  if (!view.installed) return 'Not installed';
  return view.loggedIn ? (view.account?.email ?? 'Signed in') : 'Not signed in';
}

/** Settings for the AI tools: which one answers Generate and Chat, its account, model and effort. */
export function AiAccountPage({ onBack }: AiAccountPageProps) {
  const { state, reload } = useAiProviders();
  const [pickedId, setPickedId] = useState<ProviderId | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const data = state.status === 'ready' ? state.data : null;
  const selectedId = pickedId ?? data?.defaultProvider ?? null;
  const current = data?.providers.find((p) => p.id === selectedId) ?? null;

  async function perform(action: () => Promise<unknown>, done: string): Promise<void> {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await action();
      await reload();
      setNotice(done);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  function saveSelection(id: ProviderId, selection: ProviderSelection): void {
    void perform(() => aiApi.saveSelection(id, selection), 'Saved.');
  }

  function makeDefault(id: ProviderId, label: string): void {
    void perform(() => aiApi.setDefault(id), `${label} now answers Generate and Chat.`);
  }

  return (
    <div className="app">
      <main className="ai-page">
        <header className="ai-page-header">
          <button type="button" className="link-button" onClick={onBack}>
            ← Drawings
          </button>
          <h1>AI tools</h1>
          <p className="lede">
            Generate and Chat use the account you are signed in to in each tool. Sign-in stays with
            the tool itself, and no API key is used.
          </p>
        </header>

        {state.status === 'loading' && <p className="muted">Checking your accounts…</p>}
        {state.status === 'error' && (
          <p role="alert" className="banner error">
            {state.message}
          </p>
        )}

        {data && current && (
          <div className="ai-layout">
            <nav className="tool-list" aria-label="AI tools">
              {data.providers.map((view) => (
                <button
                  key={view.id}
                  type="button"
                  className="tool-option"
                  aria-pressed={view.id === selectedId}
                  onClick={() => setPickedId(view.id)}
                >
                  <span className="tool-option-name">{view.label}</span>
                  <span className="tool-option-status">{toolStatus(view)}</span>
                  {view.id === data.defaultProvider && <span className="tag">Default</span>}
                </button>
              ))}
            </nav>

            <div className="tool-detail">
              <AccountCard view={current} />
              <ModelControls
                key={`${current.id}:${current.selection.model}:${current.selection.effort}`}
                view={current}
                busy={busy}
                onSave={(selection) => saveSelection(current.id, selection)}
              />
              <SignInSection key={current.id} view={current} onChanged={reload} />

              {current.id !== data.defaultProvider && (
                <section className="tool-settings">
                  <h3>Default tool</h3>
                  <p className="muted">
                    Generate and Chat use the default tool. Make {current.label} the default to
                    switch.
                  </p>
                  <div className="form-actions">
                    <button
                      type="button"
                      className="button"
                      disabled={busy || !current.loggedIn}
                      onClick={() => makeDefault(current.id, current.label)}
                    >
                      Use {current.label} for Generate and Chat
                    </button>
                  </div>
                </section>
              )}
            </div>
          </div>
        )}

        {notice && (
          <p role="status" className="notice ok">
            {notice}
          </p>
        )}
        {error && (
          <p role="alert" className="banner error">
            {error}
          </p>
        )}
      </main>
    </div>
  );
}
