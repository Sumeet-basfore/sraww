import path from 'node:path';
import type { AppConfig } from '../config.ts';
import type { AiProvider, ProviderId } from './provider.ts';
import { createClaudeProvider } from './providers/claude-cli.ts';
import { createCodexProvider } from './providers/codex-cli.ts';

export interface AiServices {
  defaultProvider: ProviderId;
  providers: Record<ProviderId, AiProvider>;
}

/** Builds both CLI providers from configuration. Nothing here reads or stores credentials. */
export function createAiServices(config: AppConfig): AiServices {
  const workdir = path.resolve(config.AI_WORKDIR);
  const timeoutMs = config.AI_TIMEOUT_MS;
  return {
    defaultProvider: config.AI_PROVIDER,
    providers: {
      claude: createClaudeProvider({
        bin: config.CLAUDE_BIN,
        model: config.CLAUDE_MODEL,
        workdir,
        timeoutMs,
      }),
      codex: createCodexProvider({
        bin: config.CODEX_BIN,
        model: config.CODEX_MODEL,
        workdir,
        timeoutMs,
      }),
    },
  };
}
