import { CaptureUpdateAction, convertToExcalidrawElements } from '@excalidraw/excalidraw';
import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types';
import { useEffect, useState, type FormEvent } from 'react';
import { aiApi } from '../lib/api.ts';
import { errorMessage } from '../lib/errors.ts';
import type { DiagramGraph } from '../../shared/ai-schemas.ts';
import { layoutGraph } from './layout.ts';
import { graphToSkeleton } from './skeleton.ts';
import { ToolSummary } from './ToolSummary.tsx';
import { useAiProviders } from './useAiProviders.ts';
import { defaultView, isReady } from './toolSummary.ts';

interface GeneratePanelProps {
  getApi: () => ExcalidrawImperativeAPI | null;
  onClose: () => void;
}

export function GeneratePanel({ getApi, onClose }: GeneratePanelProps) {
  const { state } = useAiProviders();
  const view = state.status === 'ready' ? defaultView(state.data) : null;
  const ready = isReady(view);
  const [prompt, setPrompt] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<DiagramGraph | null>(null);

  useEffect(() => {
    function onKey(event: KeyboardEvent): void {
      if (event.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  async function handleGenerate(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!view || !ready) return;
    setBusy(true);
    setError(null);
    setPreview(null);
    try {
      const result = await aiApi.generate(prompt.trim(), view.id);
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
    <aside className="sheet" role="dialog" aria-labelledby="ai-panel-title">
      <header className="sheet-header">
        <h2 id="ai-panel-title">Generate a diagram</h2>
        <button type="button" className="button ghost small" onClick={onClose}>
          Close
        </button>
      </header>

      <ToolSummary state={state} />

      <form className="stack" onSubmit={(e) => void handleGenerate(e)}>
        <label className="field" htmlFor="ai-prompt">
          <span>Describe the diagram</span>
          <textarea
            id="ai-prompt"
            rows={5}
            maxLength={2000}
            value={prompt}
            disabled={busy}
            placeholder="Checkout flow: cart, then payment, then confirmation email"
            onChange={(e) => setPrompt(e.target.value)}
          />
        </label>
        <div className="form-actions">
          <button
            type="submit"
            className="button primary"
            disabled={busy || !ready || prompt.trim().length < 3}
          >
            {busy ? 'Working…' : 'Generate'}
          </button>
        </div>
      </form>

      {error && (
        <p role="alert" className="banner error">
          {error}
        </p>
      )}

      {preview && (
        <div className="preview">
          <p>
            {preview.nodes.length} shapes and {preview.edges.length} connections, laid out
            automatically.
          </p>
          <div className="form-actions">
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
              className="button"
              disabled={busy}
              onClick={() => void insert('replace')}
            >
              Replace drawing
            </button>
          </div>
        </div>
      )}

      <p className="muted small">Runs through your local Claude Code or Codex sign-in.</p>
    </aside>
  );
}
