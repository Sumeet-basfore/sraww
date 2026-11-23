import { runCommand } from '../runner.ts';
import { AiError } from '../ai-error.ts';
import { isRecord, parseJsonOutput } from '../parse-output.ts';
import type { ClaudeLogin } from './claude-login.ts';
import {
  PROVIDER_LABELS,
  type AccountInfo,
  type Effort,
  type LoginFlow,
  type ModelOption,
  type ProviderSelection,
  type ProviderView,
} from '../../../shared/ai-account.ts';

export interface ClaudeAccount {
  view(): Promise<ProviderView>;
  models(): Promise<ModelOption[]>;
  startLogin(): Promise<LoginFlow>;
  submitLoginCode(code: string): Promise<LoginFlow>;
  currentLogin(): LoginFlow | null;
  cancelLogin(): Promise<LoginFlow | null>;
}

/**
 * The aliases the Claude Code CLI documents. An alias follows that model's latest version.
 * Claude Code has no call that lists models, so this list is kept here.
 */
const CLAUDE_EFFORTS: Effort[] = ['low', 'medium', 'high', 'xhigh', 'max'];
const CLAUDE_MODELS: ModelOption[] = [
  { id: 'sonnet', label: 'Sonnet', efforts: CLAUDE_EFFORTS, defaultEffort: null },
  { id: 'opus', label: 'Opus', efforts: CLAUDE_EFFORTS, defaultEffort: null },
  { id: 'fable', label: 'Fable', efforts: CLAUDE_EFFORTS, defaultEffort: null },
];
const NO_SELECTION: ProviderSelection = { model: null, effort: null };
const STATUS_TIMEOUT_MS = 20_000;
const MAX_OUTPUT_BYTES = 256 * 1024;

interface ClaudeStatus {
  loggedIn: boolean;
  account: AccountInfo | null;
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

/** Reads `claude auth status`. It prints the account identity but no tokens. */
async function readStatus(bin: string, workdir: string): Promise<ClaudeStatus> {
  const result = await runCommand({
    command: bin,
    args: ['auth', 'status'],
    input: '',
    cwd: workdir,
    timeoutMs: STATUS_TIMEOUT_MS,
    maxOutputBytes: MAX_OUTPUT_BYTES,
  });
  const parsed = parseJsonOutput(result.stdout);
  if (!isRecord(parsed) || parsed.loggedIn !== true) return { loggedIn: false, account: null };
  const method = text(parsed.authMethod);
  return {
    loggedIn: true,
    account: {
      email: text(parsed.email),
      plan: text(parsed.subscriptionType),
      organization: text(parsed.orgName),
      method: method === 'claude.ai' ? 'Claude subscription' : (method ?? 'Claude Code'),
    },
  };
}

export function createClaudeAccount(options: {
  bin: string;
  workdir: string;
  selection: () => ProviderSelection;
  login: ClaudeLogin;
}): ClaudeAccount {
  const { bin, workdir, login } = options;

  async function view(): Promise<ProviderView> {
    const base = {
      id: 'claude' as const,
      label: PROVIDER_LABELS.claude,
      models: CLAUDE_MODELS,
      selection: options.selection(),
      cliDefault: NO_SELECTION,
      canPasteCode: true,
      login: login.current(),
    };
    try {
      const status = await readStatus(bin, workdir);
      const email = status.account?.email;
      return {
        ...base,
        installed: true,
        loggedIn: status.loggedIn,
        detail: status.loggedIn
          ? `Signed in${email ? ` as ${email}` : ''}.`
          : 'Not signed in. Sign in with your Claude account to use Claude Code.',
        account: status.account,
      };
    } catch (err) {
      const missing = err instanceof AiError && err.code === 'NOT_INSTALLED';
      return {
        ...base,
        installed: !missing,
        loggedIn: false,
        detail: missing
          ? 'Claude Code is not installed. Install it or set CLAUDE_BIN.'
          : 'Could not read the Claude Code account. Try again in a moment.',
        account: null,
      };
    }
  }

  return {
    view,
    models: async () => CLAUDE_MODELS,
    startLogin: async () => login.start(),
    submitLoginCode: async (code) => login.submitCode(code),
    currentLogin: () => login.current(),
    cancelLogin: async () => login.cancel(),
  };
}
