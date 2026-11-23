import {
  EFFORT_LEVELS,
  type Effort,
  type ModelOption,
  type ProviderView,
  type ProvidersView,
} from '../../shared/ai-account.ts';

/** Efforts a choice can use: the model's own list, or every level when the CLI picks the model. */
export function effortsFor(models: ModelOption[], modelId: string | null): Effort[] {
  const chosen = modelId ? models.find((m) => m.id === modelId) : undefined;
  if (chosen) return chosen.efforts;
  return EFFORT_LEVELS.filter((level) => models.some((m) => m.efforts.includes(level)));
}

/** The tool chosen for Generate and Chat, or null while unknown. */
export function defaultView(data: ProvidersView): ProviderView | null {
  return data.providers.find((p) => p.id === data.defaultProvider) ?? null;
}

export function isReady(view: ProviderView | null): boolean {
  return Boolean(view?.installed && view.loggedIn);
}

/** Describes the model and effort a tool will use, e.g. "Opus · high effort". */
export function selectionLabel(view: ProviderView): string {
  const { selection, cliDefault, models } = view;
  const modelId = selection.model ?? cliDefault.model;
  const model = modelId
    ? (models.find((m) => m.id === modelId)?.label ?? modelId)
    : 'CLI default model';
  const effort = selection.effort ?? cliDefault.effort;
  return effort ? `${model} · ${effort} effort` : model;
}
