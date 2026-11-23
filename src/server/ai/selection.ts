import {
  type Effort,
  type ModelOption,
  type ProviderSelection,
  EFFORT_LEVELS,
} from '../../shared/ai-account.ts';

/** An error the client can read, returned as HTTP 400. */
export function badRequest(message: string): Error & { status: number; expose: boolean } {
  return Object.assign(new Error(message), { status: 400, expose: true });
}

/**
 * Checks a chosen model and effort against what the tool offers. A null model means the CLI's
 * own default, so any effort in the offered list is accepted with it.
 */
export function checkSelection(selection: ProviderSelection, models: ModelOption[]): void {
  if (selection.model !== null && !models.some((m) => m.id === selection.model)) {
    throw badRequest(`“${selection.model}” is not a model this tool offers.`);
  }
  if (selection.effort === null) return;

  const chosen = selection.model === null ? null : models.find((m) => m.id === selection.model);
  const allowed: Effort[] = chosen
    ? chosen.efforts
    : [...new Set(models.flatMap((m) => m.efforts))];
  if (!allowed.includes(selection.effort)) {
    const names = EFFORT_LEVELS.filter((level) => allowed.includes(level)).join(', ');
    throw badRequest(
      `The “${selection.effort}” effort is not available${chosen ? ` for ${chosen.label}` : ''}. Choose one of: ${names || 'none'}.`,
    );
  }
}
