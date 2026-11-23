import type { ProviderView } from '../../../shared/ai-account.ts';

function statusOf(view: ProviderView): { tone: 'ok' | 'warn' | 'off'; text: string } {
  if (!view.installed) return { tone: 'off', text: 'Not installed' };
  if (view.loggedIn) return { tone: 'ok', text: 'Signed in' };
  return { tone: 'warn', text: 'Not signed in' };
}

/** Who the tool is signed in as, and on which plan. Shows only what the CLI reports. */
export function AccountCard({ view }: { view: ProviderView }) {
  const status = statusOf(view);
  const account = view.account;
  return (
    <section className="account-card" aria-labelledby="tool-title">
      <p className={`status-line ${status.tone}`}>
        <span className="status-dot" aria-hidden="true" />
        {status.text}
      </p>
      <h2 id="tool-title">{view.label}</h2>
      {account ? (
        <dl className="facts">
          <div>
            <dt>Account</dt>
            <dd>{account.email ?? 'Not shared by the CLI'}</dd>
          </div>
          {account.plan && (
            <div>
              <dt>Plan</dt>
              <dd>{account.plan}</dd>
            </div>
          )}
          {account.organization && (
            <div>
              <dt>Workspace</dt>
              <dd>{account.organization}</dd>
            </div>
          )}
          <div>
            <dt>Signed in with</dt>
            <dd>{account.method}</dd>
          </div>
        </dl>
      ) : (
        <p className="muted">{view.detail}</p>
      )}
    </section>
  );
}
