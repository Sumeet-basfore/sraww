import { useState } from 'react';
import { aiApi } from '../../lib/api.ts';
import { errorMessage } from '../../lib/errors.ts';
import { aiSettingsHash } from '../../lib/route.ts';
import {
  EFFORT_LEVELS,
  type Effort,
  type ProviderId,
  type ProviderView,
  type ProvidersView,
} from '../../../shared/ai-account.ts';
import { effortsFor, isReady } from '../toolSummary.ts';

interface ComposerSettingsProps {
  data: ProvidersView;
  view: ProviderView;
  disabled: boolean;
  /** Called after a change is saved, so every panel reads the same settings. */
  onChanged: (savedData: ProvidersView) => Promise<void>;
  onError: (message: string) => void;
  onSavingChange: (saving: boolean) => void;
}

/**
 * The tool, model and effort the assistant answers with. Each change is saved at once, to the
 * same settings the AI tools page uses, so the two never disagree.
 */
export function ComposerSettings({
  data,
  view,
  disabled,
  onChanged,
  onError,
  onSavingChange,
}: ComposerSettingsProps) {
  const [saving, setSaving] = useState(false);
  const off = disabled || saving;
  const efforts = effortsFor(view.models, view.selection.model);
  const ready = isReady(view);

  async function save<T>(
    action: () => Promise<T>,
    savedData: (result: T) => ProvidersView,
  ): Promise<void> {
    setSaving(true);
    onSavingChange(true);
    try {
      const result = await action();
      await onChanged(savedData(result));
    } catch (err) {
      onError(errorMessage(err));
    } finally {
      setSaving(false);
      onSavingChange(false);
    }
  }

  function chooseTool(id: ProviderId): void {
    void save(
      () => aiApi.setDefault(id),
      () => ({ ...data, defaultProvider: id }),
    );
  }

  function chooseModel(modelId: string): void {
    const model = modelId || null;
    // Keep the effort only when the new model offers it; otherwise fall back to the default.
    const allowed = effortsFor(view.models, model);
    const effort =
      view.selection.effort && allowed.includes(view.selection.effort)
        ? view.selection.effort
        : null;
    void save(
      () => aiApi.saveSelection(view.id, { model, effort }),
      (updated) => {
        return {
          ...data,
          providers: data.providers.map((provider) =>
            provider.id === updated.id ? updated : provider,
          ),
        };
      },
    );
  }

  function chooseEffort(value: string): void {
    const effort: Effort | null = EFFORT_LEVELS.find((level) => level === value) ?? null;
    void save(
      () => aiApi.saveSelection(view.id, { model: view.selection.model, effort }),
      (updated) => {
        return {
          ...data,
          providers: data.providers.map((provider) =>
            provider.id === updated.id ? updated : provider,
          ),
        };
      },
    );
  }

  const cliModel = view.cliDefault.model;

  return (
    <div className="composer-settings">
      <select
        className="composer-select"
        aria-label="AI tool"
        value={data.defaultProvider}
        disabled={off}
        onChange={(e) => chooseTool(e.target.value as ProviderId)}
      >
        {data.providers.map((p) => (
          <option key={p.id} value={p.id} disabled={!isReady(p)}>
            {p.label}
            {isReady(p) ? '' : ' (not signed in)'}
          </option>
        ))}
      </select>

      {ready && (
        <select
          className="composer-select"
          aria-label="Model"
          value={view.selection.model ?? ''}
          disabled={off}
          onChange={(e) => chooseModel(e.target.value)}
        >
          <option value="">CLI default{cliModel ? ` (${cliModel})` : ''}</option>
          {view.models.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label}
            </option>
          ))}
        </select>
      )}

      {ready && efforts.length > 0 && (
        <select
          className="composer-select"
          aria-label="Effort"
          value={view.selection.effort ?? ''}
          disabled={off}
          onChange={(e) => chooseEffort(e.target.value)}
        >
          <option value="">Default effort</option>
          {efforts.map((level) => (
            <option key={level} value={level}>
              {level} effort
            </option>
          ))}
        </select>
      )}

      {!ready && (
        <p className="composer-note warn" role="status">
          {view.label} is not ready. {view.detail} <a href={aiSettingsHash()}>Open AI tools</a>
        </p>
      )}
    </div>
  );
}
