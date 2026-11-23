import { z } from 'zod';

// Shared between the server and the client: which AI tool is in use, which account it is
// signed in to, which model and effort it uses, and the state of a sign-in in progress.

export const PROVIDER_IDS = ['claude', 'codex'] as const;
export const providerIdSchema = z.enum(PROVIDER_IDS);
export type ProviderId = z.infer<typeof providerIdSchema>;

export const EFFORT_LEVELS = ['low', 'medium', 'high', 'xhigh', 'max', 'ultra'] as const;
export const effortSchema = z.enum(EFFORT_LEVELS);
export type Effort = z.infer<typeof effortSchema>;

/** Model ids are CLI aliases or Codex slugs. Keep them to plain identifier characters. */
export const modelIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(80)
  .regex(/^[A-Za-z0-9][A-Za-z0-9._:/-]*$/);

export const selectionSchema = z.object({
  model: modelIdSchema.nullable(),
  effort: effortSchema.nullable(),
});
export type ProviderSelection = z.infer<typeof selectionSchema>;

export const defaultProviderBodySchema = z.object({ provider: providerIdSchema });

/** A pasted sign-in code. Claude prints a code of URL-safe characters, sometimes with a '#'. */
export const loginCodeBodySchema = z.object({
  code: z
    .string()
    .trim()
    .min(4)
    .max(200)
    .regex(/^[A-Za-z0-9._~#=+/-]+$/),
});

export interface ModelOption {
  id: string;
  label: string;
  efforts: Effort[];
  defaultEffort: Effort | null;
}

export interface AccountInfo {
  email: string | null;
  plan: string | null;
  organization: string | null;
  method: string;
}

export type LoginStatus = 'pending' | 'awaiting-code' | 'succeeded' | 'failed' | 'cancelled';

export interface LoginFlow {
  provider: ProviderId;
  status: LoginStatus;
  /** Where the user signs in. */
  url: string | null;
  /** A code the user types on the sign-in page (Codex device login). */
  code: string | null;
  message: string | null;
}

export interface ProviderView {
  id: ProviderId;
  label: string;
  installed: boolean;
  loggedIn: boolean;
  detail: string;
  account: AccountInfo | null;
  models: ModelOption[];
  /** What sraww uses for this tool. Null fields mean "the CLI's own default". */
  selection: ProviderSelection;
  /** What the CLI itself is configured to use, for comparison. */
  cliDefault: ProviderSelection;
  /** Whether sign-in needs a code pasted back into sraww. */
  canPasteCode: boolean;
  login: LoginFlow | null;
}

export interface ProvidersView {
  defaultProvider: ProviderId;
  providers: ProviderView[];
}

export const PROVIDER_LABELS: Record<ProviderId, string> = {
  claude: 'Claude Code',
  codex: 'Codex',
};

/** True when a login has finished one way or another and polling can stop. */
export function isTerminal(status: LoginStatus): boolean {
  return status === 'succeeded' || status === 'failed' || status === 'cancelled';
}
