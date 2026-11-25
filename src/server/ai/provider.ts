import type { z } from 'zod';

export type ProviderId = 'claude' | 'codex';

export interface ProviderHealth {
  id: ProviderId;
  installed: boolean;
  loggedIn: boolean;
  detail: string;
}

export interface GenerateOptions {
  /**
   * Lets the CLI search the web and read pages. Claude Code offers only its search and page-reading
   * tools for such a call. Codex cannot be limited that way, so it refuses the call. Off by default,
   * so ordinary calls have no web access.
   */
  webSearch?: boolean;
  /** Requires the CLI to run with every tool disabled. The call must fail if that cannot be guaranteed. */
  disableTools?: boolean;
}

/** A local AI CLI that answers with structured JSON. Implementations never see API keys. */
export interface AiProvider {
  readonly id: ProviderId;
  health(): Promise<ProviderHealth>;
  generate<T>(prompt: string, schema: z.ZodType<T>, options?: GenerateOptions): Promise<T>;
}

export const HEALTH_CACHE_MS = 30_000;

/** Caches health checks briefly so the UI's status poll does not start a process every time. */
export function withHealthCache(
  check: () => Promise<ProviderHealth>,
  now: () => number = Date.now,
): () => Promise<ProviderHealth> {
  let cached: { at: number; value: ProviderHealth } | null = null;
  return async () => {
    if (cached && now() - cached.at < HEALTH_CACHE_MS) return cached.value;
    const value = await check();
    cached = { at: now(), value };
    return value;
  };
}
