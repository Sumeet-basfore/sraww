import { z } from 'zod';

const envSchema = z.object({
  PORT: z.coerce.number().int().min(1).max(65535).default(4317),
  DIAGRAMS_DIR: z.string().min(1).default('./data/diagrams'),
  AI_PROVIDER: z.enum(['claude', 'codex']).default('claude'),
  CLAUDE_BIN: z.string().min(1).default('claude'),
  CODEX_BIN: z.string().min(1).default('codex'),
  CLAUDE_MODEL: z.string().optional(),
  CODEX_MODEL: z.string().optional(),
  AI_TIMEOUT_MS: z.coerce.number().int().min(1000).default(120_000),
});

export type AppConfig = z.infer<typeof envSchema>;

/** Validates environment variables once at startup. Throws with a readable message on bad input. */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const parsed = envSchema.safeParse(env);
  if (!parsed.success) {
    const problems = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`);
    throw new Error(`Invalid configuration:\n${problems.join('\n')}`);
  }
  // Empty model overrides mean "use the CLI default".
  return {
    ...parsed.data,
    CLAUDE_MODEL: parsed.data.CLAUDE_MODEL || undefined,
    CODEX_MODEL: parsed.data.CODEX_MODEL || undefined,
  };
}
