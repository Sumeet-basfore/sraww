import { CaptureUpdateAction } from '@excalidraw/excalidraw';
import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types';
import { useEffect, useState, type KeyboardEvent } from 'react';
import { aiApi, type ChatResponse } from '../lib/api.ts';
import { errorMessage } from '../lib/errors.ts';
import type { ChatOp } from '../../shared/chat-schemas.ts';
import { applyChatOps, type EditableElement } from './apply-ops.ts';
import { summarizeScene } from './scene-summary.ts';
import { ToolSummary } from './ToolSummary.tsx';
import { useAiProviders } from './useAiProviders.ts';
import { defaultView, isReady } from './toolSummary.ts';

const EXPLAIN_MESSAGE = 'Explain the selected part of this diagram in plain language.';

interface Message {
  role: 'user' | 'assistant';
  text: string;
  notes?: string[];
}

function changeCount(ops: readonly ChatOp[]): number {
  return ops.reduce((total, op) => {
    if (op.type === 'addNodes') return total + op.nodes.length;
    if (op.type === 'addEdges') return total + op.edges.length;
    return total + op.ids.length;
  }, 0);
}

interface ChatPanelProps {
  getApi: () => ExcalidrawImperativeAPI | null;
  onClose: () => void;
}

export function ChatPanel({ getApi, onClose }: ChatPanelProps) {
  const { state } = useAiProviders();
  const view = state.status === 'ready' ? defaultView(state.data) : null;
  const ready = isReady(view);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send(mode: 'edit' | 'explain'): Promise<void> {
    const api = getApi();
    if (!api || !view || !ready || busy) return;
    const text = mode === 'explain' ? EXPLAIN_MESSAGE : input.trim();
    if (!text) return;

    const selectedIds = new Set(Object.keys(api.getAppState().selectedElementIds ?? {}));
    if (mode === 'explain' && selectedIds.size === 0) {
      setError('Select one or more shapes on the drawing first.');
      return;
    }

    const summary = summarizeScene(
      api.getSceneElements(),
      mode === 'explain' ? selectedIds : undefined,
    );
    const history = messages.slice(-12).map(({ role, text: body }) => ({ role, text: body }));
    setMessages((prev) => [...prev, { role: 'user', text }]);
    setInput('');
    setError(null);
    setBusy(true);
    try {
      const result: ChatResponse = await aiApi.chat({
        message: text,
        history,
        summary,
        provider: view.id,
      });
      const notes = [...result.rejected];
      if (mode === 'edit' && result.ops.length > 0) {
        const next = applyChatOps(
          api.getSceneElementsIncludingDeleted() as unknown as EditableElement[],
          result.ops,
        );
        api.updateScene({
          elements: next as never,
          captureUpdate: CaptureUpdateAction.IMMEDIATELY,
        });
        notes.unshift(`${changeCount(result.ops)} change(s) applied. Undo with Ctrl+Z.`);
      }
      if (mode === 'explain') notes.push('No changes made.');
      setMessages((prev) => [...prev, { role: 'assistant', text: result.reply, notes }]);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    function onKey(event: globalThis.KeyboardEvent): void {
      if (event.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  function handleKey(event: KeyboardEvent<HTMLTextAreaElement>): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      void send('edit');
    }
  }

  return (
    <aside className="sheet chat-sheet" role="dialog" aria-labelledby="chat-title">
      <header className="sheet-header">
        <h2 id="chat-title">Chat about this diagram</h2>
        <button type="button" className="button ghost small" onClick={onClose}>
          Close
        </button>
      </header>

      <ToolSummary state={state} />

      {error && (
        <p role="alert" className="banner error">
          {error}
        </p>
      )}

      <ol className="chat-log" aria-live="polite">
        {messages.length === 0 && (
          <li className="chat-empty muted">
            Try “Add a cache between the API and the database”, or select shapes and choose “Explain
            selection”.
          </li>
        )}
        {messages.map((message, index) => (
          <li key={index} className={`chat-message ${message.role}`}>
            <p>{message.text}</p>
            {message.notes?.map((note) => (
              <p key={note} className="chat-note">
                {note}
              </p>
            ))}
          </li>
        ))}
      </ol>

      <form
        className="chat-form"
        onSubmit={(e) => {
          e.preventDefault();
          void send('edit');
        }}
      >
        <label htmlFor="chat-input" className="visually-hidden">
          Message
        </label>
        <textarea
          id="chat-input"
          rows={3}
          maxLength={2000}
          value={input}
          disabled={busy || !ready}
          placeholder="Ask for a change…"
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKey}
        />
        <div className="chat-actions">
          <button
            type="button"
            className="button ghost small"
            disabled={busy || !ready}
            onClick={() => void send('explain')}
          >
            Explain selection
          </button>
          <button
            type="submit"
            className="button primary small"
            disabled={busy || !ready || !input.trim()}
          >
            {busy ? 'Working…' : 'Send'}
          </button>
        </div>
      </form>
    </aside>
  );
}
