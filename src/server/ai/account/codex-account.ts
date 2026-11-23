import { isRecord } from '../parse-output.ts';
import { AiError } from '../ai-error.ts';
import type { CodexAppServer } from './codex-app-server.ts';
import {
  EFFORT_LEVELS,
  PROVIDER_LABELS,
  type AccountInfo,
  type Effort,
  type LoginFlow,
  type ModelOption,
  type ProviderSelection,
  type ProviderView,
} from '../../../shared/ai-account.ts';

export interface CodexAccount {
  view(): Promise<ProviderView>;
  models(): Promise<ModelOption[]>;
  startLogin(): Promise<LoginFlow>;
  /** Codex signs in on its own page, so there is never a code to paste. */
  submitLoginCode(code: string): Promise<LoginFlow>;
  currentLogin(): LoginFlow | null;
  cancelLogin(): Promise<LoginFlow | null>;
}

const NO_SELECTION: ProviderSelection = { model: null, effort: null };

function text(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function isEffort(value: string | null): value is Effort {
  return value !== null && (EFFORT_LEVELS as readonly string[]).includes(value);
}

function capitalise(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function toModel(entry: unknown): ModelOption | null {
  if (!isRecord(entry) || entry.hidden === true) return null;
  const id = text(entry.model);
  if (!id) return null;
  const rawEfforts = Array.isArray(entry.supportedReasoningEfforts)
    ? entry.supportedReasoningEfforts
    : [];
  const efforts = rawEfforts
    .map((level) => (isRecord(level) ? text(level.reasoningEffort) : null))
    .filter(isEffort);
  const defaultEffort = text(entry.defaultReasoningEffort);
  return {
    id,
    label: text(entry.displayName) ?? id,
    efforts,
    defaultEffort: isEffort(defaultEffort) ? defaultEffort : null,
  };
}

/** Builds the Codex account view on top of the app server. Nothing here reads auth files. */
export function createCodexAccount(options: {
  server: CodexAppServer;
  selection: () => ProviderSelection;
}): CodexAccount {
  const { server } = options;
  let login: LoginFlow | null = null;
  let loginId: string | null = null;

  server.onNotification(({ method, params }) => {
    if (method !== 'account/login/completed' || !isRecord(params)) return;
    if (loginId === null || params.loginId !== loginId) return;
    loginId = null;
    if (!login) return;
    const succeeded = params.success === true;
    login = {
      ...login,
      status: succeeded ? 'succeeded' : 'failed',
      code: null,
      message: succeeded ? null : (text(params.error) ?? 'Sign-in did not finish.'),
    };
  });

  async function readAccount(): Promise<AccountInfo | null> {
    const result = await server.request<unknown>('account/read', { refreshToken: false });
    if (!isRecord(result) || !isRecord(result.account)) return null;
    const account = result.account;
    if (account.type !== 'chatgpt') return null;
    const plan = text(account.planType);
    return {
      email: text(account.email),
      plan: plan ? capitalise(plan) : null,
      organization: text(account.workspaceName),
      method: 'ChatGPT',
    };
  }

  async function readCliDefault(): Promise<ProviderSelection> {
    const result = await server.request<unknown>('config/read', { includeLayers: false });
    if (!isRecord(result) || !isRecord(result.config)) return NO_SELECTION;
    const effort = text(result.config.model_reasoning_effort);
    return {
      model: text(result.config.model),
      effort: isEffort(effort) ? effort : null,
    };
  }

  async function models(): Promise<ModelOption[]> {
    const result = await server.request<unknown>('model/list', { includeHidden: false });
    const data = isRecord(result) && Array.isArray(result.data) ? result.data : [];
    return data.map(toModel).filter((model): model is ModelOption => model !== null);
  }

  async function view(): Promise<ProviderView> {
    const base = {
      id: 'codex' as const,
      label: PROVIDER_LABELS.codex,
      selection: options.selection(),
      canPasteCode: false,
      login,
    };
    try {
      const [account, cliDefault, modelList] = await Promise.all([
        readAccount(),
        readCliDefault(),
        models(),
      ]);
      const loggedIn = account !== null;
      return {
        ...base,
        installed: true,
        loggedIn,
        detail: loggedIn
          ? `Signed in to ChatGPT${account.plan ? ` on the ${account.plan} plan` : ''}.`
          : 'Not signed in. Sign in with your ChatGPT account to use Codex.',
        account,
        models: modelList,
        cliDefault,
      };
    } catch (err) {
      const missing = err instanceof AiError && err.code === 'NOT_INSTALLED';
      return {
        ...base,
        installed: !missing,
        loggedIn: false,
        detail: missing
          ? 'Codex is not installed. Install it or set CODEX_BIN.'
          : 'Could not read the Codex account. Try again in a moment.',
        account: null,
        models: [],
        cliDefault: NO_SELECTION,
      };
    }
  }

  async function startLogin(): Promise<LoginFlow> {
    if (loginId !== null) await cancelLogin();
    const result = await server.request<unknown>('account/login/start', {
      type: 'chatgptDeviceCode',
    });
    const id = isRecord(result) ? text(result.loginId) : null;
    const url = isRecord(result) ? text(result.verificationUrl) : null;
    const code = isRecord(result) ? text(result.userCode) : null;
    if (!id || !url || !code) {
      throw new AiError('FAILED', 'Codex returned an unexpected sign-in reply.');
    }
    loginId = id;
    login = { provider: 'codex', status: 'pending', url, code, message: null };
    return login;
  }

  async function cancelLogin(): Promise<LoginFlow | null> {
    const id = loginId;
    if (id === null) return login;
    loginId = null;
    await server.request('account/login/cancel', { loginId: id }).catch(() => undefined);
    if (login && login.status === 'pending') {
      login = { ...login, status: 'cancelled', code: null, message: null };
    }
    return login;
  }

  return {
    view,
    models,
    startLogin,
    submitLoginCode: async () => {
      throw new AiError('FAILED', 'Codex signs in on its own page. No code needs to be pasted.');
    },
    currentLogin: () => login,
    cancelLogin,
  };
}
