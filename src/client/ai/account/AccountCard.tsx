import type { ProviderView } from '../../../shared/ai-account.ts';

/** Who the tool is signed in as, and on which plan. Shows only what the CLI reports. */
export function AccountCard({ view, titleId }: { view: ProviderView; titleId: string }) {
  const account = view.account;
  return (
    <section className="account-card">
      <div className="provider-statuses" aria-label="Tool status">
        <span className={`provider-status ${view.installed ? 'installed' : 'not-installed'}`}>
          <span className="status-dot" aria-hidden="true" />
          {view.installed ? 'Installed' : 'Not installed'}
        </span>
        <span className={`provider-status ${view.loggedIn ? 'signed-in' : 'sign-in-needed'}`}>
          <span className="status-dot" aria-hidden="true" />
          {view.loggedIn ? 'Signed in' : 'Sign-in needed'}
        </span>
      </div>
      <h2 id={titleId}>{view.label}</h2>
      <p className="provider-description">
        {view.id === 'claude'
          ? 'Claude Code account and model settings reported by its CLI.'
          : 'Codex account and model settings reported by its CLI.'}
      </p>
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
