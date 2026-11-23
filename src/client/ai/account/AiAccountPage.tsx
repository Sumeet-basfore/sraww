import { useState } from 'react';
import { aiApi } from '../../lib/api.ts';
import { errorMessage } from '../../lib/errors.ts';
import type { ProviderId, ProviderSelection } from '../../../shared/ai-account.ts';
import { useAiProviders } from '../useAiProviders.ts';
import { Logo } from '../../brand/Logo.tsx';
import { AccountCard } from './AccountCard.tsx';
import { ModelControls } from './ModelControls.tsx';
import { SignInSection } from './SignInSection.tsx';
import './ai-tools.css';

interface AiAccountPageProps {
  onBack: () => void;
  onShowTour: () => void;
}

function providerStatus(view: { installed: boolean; loggedIn: boolean }): string {
  return `${view.installed ? 'Installed' : 'Not installed'} · ${view.loggedIn ? 'Signed in' : 'Sign-in needed'}`;
}

/** Settings for the AI tools: account, model and effort for both supported providers. */
export function AiAccountPage({ onBack, onShowTour }: AiAccountPageProps) {
  const { state, reload } = useAiProviders();
  const [pickedDefaultId, setPickedDefaultId] = useState<ProviderId | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const data = state.status === 'ready' ? state.data : null;
  const selectedDefaultId = pickedDefaultId ?? data?.defaultProvider;

  async function perform(action: () => Promise<unknown>, done: string): Promise<boolean> {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await action();
      await reload();
      setNotice(done);
      return true;
    } catch (err) {
      setError(errorMessage(err));
      return false;
    } finally {
      setBusy(false);
    }
  }

  function saveSelection(id: ProviderId, selection: ProviderSelection): void {
    void perform(() => aiApi.saveSelection(id, selection), 'Saved.');
  }

  async function makeDefault(id: ProviderId, label: string): Promise<void> {
    setPickedDefaultId(id);
    const saved = await perform(
      () => aiApi.setDefault(id),
      `${label} now answers Generate and Chat.`,
    );
    if (!saved) setPickedDefaultId(null);
  }

  return (
    <div className="app">
      <main className="ai-page">
        <header className="masthead ai-masthead">
          <Logo className="brand-lockup" />
          <nav className="masthead-links" aria-label="Main navigation">
            <a className="link-button" href="#/" onClick={onBack}>
              ← Drawings
            </a>
            <button type="button" className="link-button" onClick={onShowTour}>
              Take the tour
            </button>
            <a className="link-button ai-current-link" href="#/ai" aria-current="page">
              AI tools
            </a>
          </nav>
        </header>

        <header className="ai-title-block">
          <p className="ai-eyebrow">Accounts &amp; preferences</p>
          <h1>AI tools</h1>
          <p className="lede">
            Generate and Chat use the account you are signed in to in each tool. Sign-in stays with
            the tool itself, and no API key is used.
          </p>
        </header>

        {state.status === 'loading' && <p className="muted">Checking your accounts…</p>}
        {state.status === 'error' && (
          <div className="ai-load-error" role="alert">
            <p>{state.message}</p>
            <button type="button" className="button" onClick={() => void reload()}>
              Retry
            </button>
          </div>
        )}
        {state.status === 'ready' && state.refreshError && (
          <div className="ai-load-error" role="alert">
            <p>{state.refreshError}</p>
            <button type="button" className="button" onClick={() => void reload()}>
              Retry
            </button>
          </div>
        )}

        {data && (
          <>
            <section className="default-tool-panel" aria-label="Default tool settings">
              <div className="default-tool-copy">
                <h2>Default tool</h2>
                <p>Generate and Chat use the selected tool.</p>
              </div>
              <fieldset className="default-tool-group" disabled={busy}>
                <legend className="visually-hidden">Default tool</legend>
                <div className="default-tool-options">
                  {data.providers.map((view) => (
                    <label className="default-tool-label" key={view.id}>
                      <input
                        type="radio"
                        name="default-tool"
                        value={view.id}
                        checked={view.id === selectedDefaultId}
                        disabled={!view.loggedIn}
                        onChange={() => void makeDefault(view.id, view.label)}
                      />
                      <span className="default-tool-option">
                        <span className="default-tool-name">{view.label}</span>
                        <span
                          className={`default-tool-status ${view.loggedIn ? 'ready' : 'needs-signin'}`}
                        >
                          {providerStatus(view)}
                        </span>
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>
            </section>

            <section className="ai-provider-grid" aria-label="AI tool accounts">
              {data.providers.map((view) => (
                <article
                  className="ai-provider-card"
                  key={view.id}
                  aria-labelledby={`provider-${view.id}-title`}
                >
                  <AccountCard view={view} titleId={`provider-${view.id}-title`} />
                  <SignInSection key={`signin:${view.id}`} view={view} onChanged={reload} />
                  <ModelControls
                    key={`${view.id}:${view.selection.model}:${view.selection.effort}`}
                    view={view}
                    busy={busy}
                    onSave={(selection) => saveSelection(view.id, selection)}
                  />
                </article>
              ))}
            </section>
          </>
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
