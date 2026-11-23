import { useEffect, useState, type FormEvent } from 'react';
import { aiApi } from '../../lib/api.ts';
import { errorMessage } from '../../lib/errors.ts';
import { isTerminal, type LoginFlow, type ProviderView } from '../../../shared/ai-account.ts';

const POLL_INTERVAL_MS = 2_000;

interface SignInSectionProps {
  view: ProviderView;
  onChanged: () => Promise<void>;
}

/** Only https links from the CLI are shown as links. Anything else is shown as plain text. */
function safeLink(url: string | null): string | null {
  return url && url.startsWith('https://') ? url : null;
}

export function SignInSection({ view, onChanged }: SignInSectionProps) {
  const [flow, setFlow] = useState<LoginFlow | null>(view.login);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inProgress = flow !== null && !isTerminal(flow.status);
  const titleId = `signin-title-${view.id}`;
  const codeId = `signin-code-${view.id}`;

  // While a sign-in is running, check on it every few seconds until it finishes.
  useEffect(() => {
    if (!inProgress) return undefined;
    let stopped = false;
    const timer = setInterval(() => {
      aiApi
        .loginStatus(view.id)
        .then(async ({ login }) => {
          if (stopped || !login) return;
          setFlow(login);
          if (isTerminal(login.status)) await onChanged();
        })
        .catch((err: unknown) => {
          if (!stopped) setError(errorMessage(err));
        });
    }, POLL_INTERVAL_MS);
    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }, [inProgress, view.id, onChanged]);

  async function run(action: () => Promise<{ login: LoginFlow | null }>): Promise<void> {
    setBusy(true);
    setError(null);
    try {
      const { login } = await action();
      setFlow(login);
      if (login && isTerminal(login.status)) await onChanged();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  function submitCode(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    const trimmed = code.trim();
    if (!trimmed) return;
    setCode('');
    void run(() => aiApi.submitLoginCode(view.id, trimmed));
  }

  if (!view.installed) {
    return (
      <section className="tool-settings" aria-labelledby={titleId}>
        <h3 id={titleId}>Sign in</h3>
        <p className="muted">{view.detail}</p>
      </section>
    );
  }

  const link = safeLink(flow?.url ?? null);
  const title = view.loggedIn ? 'Switch account' : 'Sign in';
  const actionLabel = view.loggedIn ? 'Sign in with another account' : 'Sign in';

  return (
    <section className="tool-settings" aria-labelledby={titleId}>
      <h3 id={titleId}>{title}</h3>

      {!inProgress && !flow && (
        <p className="muted">
          {view.loggedIn
            ? `Signing in again replaces the account ${view.label} uses on this computer.`
            : `Sign in to ${view.label} here. The sign-in page opens in a new tab, and sraww never sees your password.`}
        </p>
      )}

      {inProgress && flow && (
        <ol className="signin-steps">
          <li>
            Open{' '}
            {link ? (
              <a href={link} target="_blank" rel="noreferrer">
                {link}
              </a>
            ) : (
              <span className="mono">the sign-in link shown by the tool</span>
            )}
          </li>
          {flow.code && (
            <li>
              Enter this code: <code className="device-code">{flow.code}</code>
            </li>
          )}
          {view.canPasteCode && flow.status !== 'pending' && (
            <li>
              Paste the code the page gives you:
              <form className="code-form" onSubmit={submitCode}>
                <label className="visually-hidden" htmlFor={codeId}>
                  Sign-in code
                </label>
                <input
                  id={codeId}
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  autoComplete="off"
                  spellCheck={false}
                  maxLength={200}
                  disabled={busy}
                />
                <button type="submit" className="button primary" disabled={busy || !code.trim()}>
                  Submit code
                </button>
              </form>
            </li>
          )}
          <li className="muted">Waiting for the sign-in to finish…</li>
        </ol>
      )}

      {flow?.status === 'succeeded' && <p className="notice ok">Signed in.</p>}
      {flow?.status === 'cancelled' && <p className="muted">Sign-in cancelled.</p>}
      {flow?.status === 'failed' && (
        <p role="alert" className="banner error">
          {flow.message ?? 'Sign-in did not finish. Try again.'}
        </p>
      )}
      {error && (
        <p role="alert" className="banner error">
          {error}
        </p>
      )}

      <div className="form-actions">
        {inProgress ? (
          <button
            type="button"
            className="button ghost"
            disabled={busy}
            onClick={() => void run(() => aiApi.cancelLogin(view.id))}
          >
            Cancel sign-in
          </button>
        ) : (
          <button
            type="button"
            className="button primary"
            disabled={busy}
            onClick={() => void run(() => aiApi.startLogin(view.id))}
          >
            {flow?.status === 'failed' ? 'Retry sign-in' : actionLabel}
          </button>
        )}
      </div>
    </section>
  );
}
