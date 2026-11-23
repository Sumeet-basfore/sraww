import path from 'node:path';
import type { AppConfig } from '../config.ts';
import type {
  LoginFlow,
  ModelOption,
  ProviderId,
  ProviderSelection,
  ProviderView,
} from '../../shared/ai-account.ts';
import type { AiProvider } from './provider.ts';
import { createClaudeProvider } from './providers/claude-cli.ts';
import { createCodexProvider } from './providers/codex-cli.ts';
import { createSettingsStore, defaultSettings, type SettingsStore } from './settings-store.ts';
import { createClaudeLogin } from './account/claude-login.ts';
import { createClaudeAccount } from './account/claude-account.ts';
import { createCodexAppServer } from './account/codex-app-server.ts';
import { createCodexAccount } from './account/codex-account.ts';

/** What the settings page needs from each tool. Both tools implement the same surface. */
export interface ProviderAccount {
  view(): Promise<ProviderView>;
  models(): Promise<ModelOption[]>;
  startLogin(): Promise<LoginFlow>;
  submitLoginCode(code: string): Promise<LoginFlow>;
  currentLogin(): LoginFlow | null;
  cancelLogin(): Promise<LoginFlow | null>;
}

export interface AiServices {
  settings: SettingsStore;
  providers: Record<ProviderId, AiProvider>;
  accounts: Record<ProviderId, ProviderAccount>;
  currentDefault(): ProviderId;
  close(): void;
}

/** The CLIs run with only PATH and HOME, the same as the AI calls. */
function childEnv(): NodeJS.ProcessEnv {
  return { PATH: process.env.PATH ?? '', HOME: process.env.HOME ?? '' };
}

/**
 * Builds both AI tools from configuration. Nothing here reads or stores credentials; the CLIs
 * keep their own sign-in. The settings file only records which model and effort to use.
 */
export function createAiServices(config: AppConfig): AiServices {
  const workdir = path.resolve(config.AI_WORKDIR);
  const timeoutMs = config.AI_TIMEOUT_MS;
  const settings = createSettingsStore(
    config.AI_SETTINGS_FILE,
    defaultSettings(config.AI_PROVIDER, { claude: config.CLAUDE_MODEL, codex: config.CODEX_MODEL }),
  );
  const selectionOf = (id: ProviderId): (() => ProviderSelection) => {
    return () => settings.snapshot().selections[id];
  };

  const claudeLogin = createClaudeLogin({ bin: config.CLAUDE_BIN, env: childEnv() });
  const codexServer = createCodexAppServer({
    bin: config.CODEX_BIN,
    cwd: workdir,
    env: childEnv(),
  });

  return {
    settings,
    providers: {
      claude: createClaudeProvider({
        bin: config.CLAUDE_BIN,
        selection: selectionOf('claude'),
        workdir,
        timeoutMs,
      }),
      codex: createCodexProvider({
        bin: config.CODEX_BIN,
        selection: selectionOf('codex'),
        workdir,
        timeoutMs,
      }),
    },
    accounts: {
      claude: createClaudeAccount({
        bin: config.CLAUDE_BIN,
        workdir,
        selection: selectionOf('claude'),
        login: claudeLogin,
      }),
      codex: createCodexAccount({ server: codexServer, selection: selectionOf('codex') }),
    },
    currentDefault: () => settings.snapshot().defaultProvider,
    close: () => {
      codexServer.close();
      claudeLogin.cancel();
    },
  };
}
