import { CaptureUpdateAction, convertToExcalidrawElements } from '@excalidraw/excalidraw';
import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types';
import { useEffect, useState, type FormEvent } from 'react';
import { aiApi, type AiStatus, type ProviderId } from '../lib/api.ts';
import { errorMessage } from '../lib/errors.ts';
import type { DiagramGraph } from '../../shared/ai-schemas.ts';
import { layoutGraph } from './layout.ts';
import { graphToSkeleton } from './skeleton.ts';

const PROVIDER_LABELS: Record<ProviderId, string> = {
  claude: 'Claude (Claude Pro login)',
  codex: 'Codex (ChatGPT Plus login)',
};

interface GeneratePanelProps {
  getApi: () => ExcalidrawImperativeAPI | null;
  onClose: () => void;
}

export function GeneratePanel({ getApi, onClose }: GeneratePanelProps) {
  const [status, setStatus] = useState<AiStatus | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [provider, setProvider] = useState<ProviderId | null>(null);
  const [prompt, setPrompt] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<DiagramGraph | null>(null);

  useEffect(() => {
    aiApi
      .status()
      .then((result) => {
        setStatus(result);
        setProvider(result.defaultProvider);
      })
      .catch((err: unknown) => setStatusError(errorMessage(err)));
  }, []);

  useEffect(() => {
    function onKey(event: KeyboardEvent): void {
      if (event.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const selected = status?.providers.find((p) => p.id === provider);
  const canUse = Boolean(selected?.installed && selected.loggedIn);

  async function handleGenerate(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!provider || !canUse) return;
    setBusy(true);
    setError(null);
    setPreview(null);
    try {
      const result = await aiApi.generate(prompt.trim(), provider);
      setPreview(result.graph);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function insert(mode: 'add' | 'replace'): Promise<void> {
    const api = getApi();
    if (!api || !preview) {
      setError('The drawing is not ready yet. Try again in a moment.');
      return;
    }
    if (
      mode === 'replace' &&
      !window.confirm('Replace everything on this drawing with the generated diagram?')
    ) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const boxes = await layoutGraph(preview);
      const created = convertToExcalidrawElements(graphToSkeleton(preview, boxes), {
        regenerateIds: true,
      });
      const existing = mode === 'add' ? api.getSceneElementsIncludingDeleted() : [];
      api.updateScene({
        elements: [...existing, ...created],
        captureUpdate: CaptureUpdateAction.IMMEDIATELY,
      });
      api.scrollToContent(created, { fitToContent: true });
      onClose();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <aside className="ai-panel" role="dialog" aria-labelledby="ai-panel-title">
      <header className="ai-panel-header">
        <h2 id="ai-panel-title">Generate with AI</h2>
        <button type="button" className="button ghost small" onClick={onClose} aria-label="Close">
          Close
        </button>
      </header>

      {statusError && (
        <p role="alert" className="banner error">
          {statusError}
        </p>
      )}

      <form className="ai-form" onSubmit={(e) => void handleGenerate(e)}>
        <label htmlFor="ai-prompt">Describe the diagram</label>
        <textarea
          id="ai-prompt"
          rows={5}
          maxLength={2000}
          value={prompt}
          disabled={busy}
          placeholder="e.g. Checkout flow: cart, then payment, then confirmation email"
          onChange={(e) => setPrompt(e.target.value)}
        />

        <label htmlFor="ai-provider">Tool</label>
        <select
          id="ai-provider"
          value={provider ?? ''}
          disabled={busy || !status}
          onChange={(e) => setProvider(e.target.value as ProviderId)}
        >
          {status?.providers.map((p) => {
            const ready = p.installed && p.loggedIn;
            return (
              <option key={p.id} value={p.id} disabled={!ready}>
                {PROVIDER_LABELS[p.id]}
                {ready ? '' : ' — unavailable'}
              </option>
            );
          })}
        </select>
        {selected && <p className="muted small">{selected.detail}</p>}

        <button
          type="submit"
          className="button primary"
          disabled={busy || !canUse || prompt.trim().length < 3}
        >
          {busy ? 'Working…' : 'Generate'}
        </button>
      </form>

      {error && (
        <p role="alert" className="banner error">
          {error}
        </p>
      )}

      {preview && (
        <div className="ai-preview">
          <p>
            {preview.nodes.length} shapes and {preview.edges.length} connections, laid out
            automatically.
          </p>
          <div className="ai-preview-actions">
            <button
              type="button"
              className="button primary"
              disabled={busy}
              onClick={() => void insert('add')}
            >
              Add to drawing
            </button>
            <button
              type="button"
              className="button ghost"
              disabled={busy}
              onClick={() => void insert('replace')}
            >
              Replace drawing
            </button>
          </div>
        </div>
      )}

      <p className="muted small">
        Runs through your local Claude Code or Codex login. No API key is used.
      </p>
    </aside>
  );
}
