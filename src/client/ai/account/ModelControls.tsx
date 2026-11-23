import { useState } from 'react';
import type { Effort, ProviderSelection, ProviderView } from '../../../shared/ai-account.ts';
import { effortsFor } from '../toolSummary.ts';

interface ModelControlsProps {
  view: ProviderView;
  busy: boolean;
  onSave: (selection: ProviderSelection) => void;
}

/** Model and effort for one tool. Drafts stay local until Save, so nothing changes by accident. */
export function ModelControls({ view, busy, onSave }: ModelControlsProps) {
  const [modelId, setModelId] = useState<string>(view.selection.model ?? '');
  const [effort, setEffort] = useState<Effort | null>(view.selection.effort);

  const model = modelId || null;
  const efforts = effortsFor(view.models, model);
  const changed = model !== view.selection.model || effort !== view.selection.effort;

  function chooseModel(next: string): void {
    setModelId(next);
    const allowed = effortsFor(view.models, next || null);
    if (effort && !allowed.includes(effort)) setEffort(null);
  }

  const cliModel = view.cliDefault.model;
  const hint =
    view.id === 'codex'
      ? `Codex is set to ${cliModel ?? 'its default model'}${view.cliDefault.effort ? ` at ${view.cliDefault.effort} effort` : ''} in your own Codex settings. Changes here apply only to sraww.`
      : 'Aliases follow the latest version of each model. Choose CLI default to let Claude Code decide.';

  return (
    <section className="tool-settings" aria-labelledby="model-title">
      <h3 id="model-title">Model and effort</h3>

      <label className="field">
        <span>Model</span>
        <select value={modelId} disabled={busy} onChange={(e) => chooseModel(e.target.value)}>
          <option value="">CLI default{cliModel ? ` (${cliModel})` : ''}</option>
          {view.models.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label}
            </option>
          ))}
        </select>
      </label>

      <fieldset className="field effort-field" disabled={busy}>
        <legend>Effort</legend>
        <div className="effort-options">
          <button type="button" aria-pressed={effort === null} onClick={() => setEffort(null)}>
            Default
          </button>
          {efforts.map((level) => (
            <button
              key={level}
              type="button"
              aria-pressed={effort === level}
              onClick={() => setEffort(level)}
            >
              {level}
            </button>
          ))}
        </div>
      </fieldset>

      <p className="muted small">{hint}</p>

      <div className="form-actions">
        <button
          type="button"
          className="button primary"
          disabled={busy || !changed}
          onClick={() => onSave({ model, effort })}
        >
          Save model and effort
        </button>
      </div>
    </section>
  );
}
