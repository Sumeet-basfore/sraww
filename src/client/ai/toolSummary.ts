import type { ProviderView, ProvidersView } from '../../shared/ai-account.ts';

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
