import { aiSettingsHash } from '../lib/route.ts';
import type { ProvidersState } from './useAiProviders.ts';
import { defaultView, isReady, selectionLabel } from './toolSummary.ts';

/** One line under the AI panels: which tool, model and effort will answer, and how to change it. */
export function ToolSummary({ state }: { state: ProvidersState }) {
  if (state.status === 'loading') return <p className="tool-summary muted">Checking AI tool…</p>;
  if (state.status === 'error') {
    return (
      <p className="tool-summary warn">
        Could not check the AI tool. <a href={aiSettingsHash()}>Open AI tools</a>
      </p>
    );
  }

  const view = defaultView(state.data);
  if (!view) return null;
  if (!isReady(view)) {
    return (
      <p className="tool-summary warn">
        {view.label} is not ready. {view.detail} <a href={aiSettingsHash()}>Open AI tools</a>
      </p>
    );
  }
  return (
    <p className="tool-summary">
      <span className="tool-name">{view.label}</span>
      <span className="tool-model">{selectionLabel(view)}</span>
      <a href={aiSettingsHash()}>Change</a>
    </p>
  );
}
