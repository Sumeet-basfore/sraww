import { CaptureUpdateAction } from '@excalidraw/excalidraw';
import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types';
import { useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { aiApi, type ChatResponse } from '../../lib/api.ts';
import { errorMessage } from '../../lib/errors.ts';
import type { DiagramGraph } from '../../../shared/ai-schemas.ts';
import type { ChatOp } from '../../../shared/chat-schemas.ts';
import { CHAT_LIMITS } from '../../../shared/chat-schemas.ts';
import { applyChatOps, type EditableElement } from '../apply-ops.ts';
import { summarizeScene } from '../scene-summary.ts';
import { useAiProviders } from '../useAiProviders.ts';
import { defaultView, isReady } from '../toolSummary.ts';
import { insertGraph } from './insert-graph.ts';
import { MessageLog, type Entry } from './MessageLog.tsx';
import { ComposerSettings } from './ComposerSettings.tsx';

const EXPLAIN_MESSAGE = 'Explain the selected part of this diagram in plain language.';
const HISTORY_LENGTH = 12;
/** Show the length counter once the message is this close to the limit. */
const COUNTER_FROM = Math.floor(CHAT_LIMITS.maxMessage * 0.8);

type Mode = 'edit' | 'new';

interface AssistantProps {
  getApi: () => ExcalidrawImperativeAPI | null;
}

function changeCount(ops: readonly ChatOp[]): number {
  return ops.reduce((total, op) => {
    if (op.type === 'addNodes') return total + op.nodes.length;
    if (op.type === 'addEdges') return total + op.edges.length;
    if (op.type === 'updateNodes') return total + op.updates.length;
    return total + op.ids.length;
  }, 0);
}

/**
 * The AI assistant, docked under the drawing. One input does both jobs: "Edit this drawing"
 * changes the open drawing, and "New diagram" proposes a new one that the user adds or replaces.
 */
export function Assistant({ getApi }: AssistantProps) {
  const { state, reload } = useAiProviders();
  const data = state.status === 'ready' ? state.data : null;
  const view = data ? defaultView(data) : null;
  const ready = isReady(view);
  const [mode, setMode] = useState<Mode>('edit');
  const [entries, setEntries] = useState<Entry[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [retryingProviders, setRetryingProviders] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const nextId = useRef(1);

  function push(entry: Omit<Entry, 'id'>): number {
    const id = nextId.current;
    nextId.current += 1;
    setEntries((prev) => [...prev, { ...entry, id }]);
    return id;
  }

  function updateEntry(id: number, patch: Partial<Entry>): void {
    setEntries((prev) => prev.map((entry) => (entry.id === id ? { ...entry, ...patch } : entry)));
  }

  function history(): { role: 'user' | 'assistant'; text: string }[] {
    return entries
      .filter((entry) => entry.role !== 'system')
      .slice(-HISTORY_LENGTH)
      .map(({ role, text }) => ({ role: role as 'user' | 'assistant', text }));
  }

  async function edit(text: string, explain: boolean): Promise<void> {
    const api = getApi();
    if (!api || !view) return;
    const selectedIds = new Set(Object.keys(api.getAppState().selectedElementIds ?? {}));
    const summary = summarizeScene(api.getSceneElements(), explain ? selectedIds : undefined);
    const result: ChatResponse = await aiApi.chat({
      message: text,
      history: history(),
      summary,
      provider: view.id,
    });
    const notes = [...result.rejected];
    if (!explain && result.ops.length > 0) {
      const next = applyChatOps(
        api.getSceneElementsIncludingDeleted() as unknown as EditableElement[],
        result.ops,
      );
      api.updateScene({ elements: next as never, captureUpdate: CaptureUpdateAction.IMMEDIATELY });
      notes.unshift(`${changeCount(result.ops)} change(s) applied. Undo with Ctrl+Z.`);
    }
    if (explain) notes.push('No changes made.');
    push({ role: 'assistant', text: result.reply, notes });
  }

  async function generate(text: string): Promise<void> {
    if (!view) return;
    const result = await aiApi.generate(text, view.id);
    push({
      role: 'assistant',
      text: `Here is a diagram with ${result.graph.nodes.length} shapes and ${result.graph.edges.length} connections.`,
      graph: result.graph,
      graphState: 'pending',
    });
  }

  async function send(event?: FormEvent<HTMLFormElement>): Promise<void> {
    event?.preventDefault();
    if (settingsSaving) return;
    const text = input.trim();
    if (!text || busy || !ready || !getApi()) return;
    setInput('');
    setError(null);
    setBusy(true);
    push({ role: 'user', text });
    try {
      if (mode === 'new') await generate(text);
      else await edit(text, false);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function explainSelection(): Promise<void> {
    if (settingsSaving) return;
    const api = getApi();
    if (!api || busy || !ready) return;
    if (Object.keys(api.getAppState().selectedElementIds ?? {}).length === 0) {
      setError('Select one or more shapes on the drawing first.');
      return;
    }
    setError(null);
    setBusy(true);
    push({ role: 'user', text: 'Explain selection' });
    try {
      await edit(EXPLAIN_MESSAGE, true);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function place(id: number, graph: DiagramGraph, how: 'add' | 'replace'): Promise<void> {
    const api = getApi();
    if (!api) return;
    if (
      how === 'replace' &&
      !window.confirm('Replace everything on this drawing with this diagram?')
    ) {
      return;
    }
    setBusy(true);
    try {
      await insertGraph(api, graph, how);
      updateEntry(id, { graphState: how === 'add' ? 'added' : 'replaced' });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  function clearConversation(): void {
    setEntries([]);
    setError(null);
  }

  async function retryProviders(): Promise<void> {
    if (retryingProviders) return;
    setRetryingProviders(true);
    try {
      await reload();
    } finally {
      setRetryingProviders(false);
    }
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>): void {
    // During IME composition, Enter confirms a candidate; it must not send the message.
    if (event.nativeEvent.isComposing) return;
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      void send();
    }
  }

  const placeholder =
    mode === 'new'
      ? 'Describe a diagram, for example: checkout flow with a queue and an email step'
      : 'Ask for a change, for example: add a cache between the API and the database';

  return (
    <section className="assistant" aria-label="AI assistant">
      {state.status === 'error' && (
        <div>
          <p role="alert" className="banner error assistant-error">
            Could not check the AI tools: {state.message}
          </p>
          <button type="button" disabled={retryingProviders} onClick={() => void retryProviders()}>
            {retryingProviders ? 'Retrying…' : 'Retry'}
          </button>
        </div>
      )}
      {state.status === 'ready' && state.refreshError && (
        <div>
          <p role="alert" className="banner error assistant-error">
            The AI tools could not be refreshed: {state.refreshError}
          </p>
          <button type="button" disabled={retryingProviders} onClick={() => void retryProviders()}>
            {retryingProviders ? 'Retrying…' : 'Retry'}
          </button>
        </div>
      )}
      {error && (
        <p role="alert" className="banner error assistant-error">
          {error}
        </p>
      )}
      {entries.length > 0 && (
        <MessageLog
          entries={entries}
          onAdd={(id, graph) => void place(id, graph, 'add')}
          onReplace={(id, graph) => void place(id, graph, 'replace')}
          busy={busy}
        />
      )}
      <form className="composer" onSubmit={(e) => void send(e)}>
        <label htmlFor="assistant-input" className="visually-hidden">
          Message the assistant
        </label>
        <textarea
          id="assistant-input"
          rows={2}
          maxLength={CHAT_LIMITS.maxMessage}
          value={input}
          disabled={busy || !ready}
          placeholder={
            state.status === 'loading'
              ? 'Checking AI tools…'
              : state.status === 'error'
                ? ''
                : ready
                  ? placeholder
                  : 'Sign in to an AI tool to start.'
          }
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKeyDown}
        />
        <div className="composer-row">
          <button
            type="button"
            className="composer-chip"
            disabled={busy || !ready || settingsSaving}
            onClick={() => void explainSelection()}
          >
            Explain selection
          </button>
          <select
            className="composer-mode"
            aria-label="What the assistant does"
            value={mode}
            disabled={busy}
            onChange={(e) => setMode(e.target.value as Mode)}
          >
            <option value="edit">Edit this drawing</option>
            <option value="new">New diagram</option>
          </select>
          {input.length >= COUNTER_FROM && (
            <span className="composer-count" aria-live="off">
              {input.length}/{CHAT_LIMITS.maxMessage}
            </span>
          )}
          <span className="composer-spacer" />
          {entries.length > 0 && (
            <button
              type="button"
              className="assistant-clear"
              disabled={busy}
              onClick={clearConversation}
            >
              Clear
            </button>
          )}
          <button
            type="submit"
            className="composer-round composer-send"
            aria-label={mode === 'new' ? 'Generate diagram' : 'Send'}
            disabled={busy || !ready || settingsSaving || !input.trim()}
          >
            {busy ? '…' : '↑'}
          </button>
        </div>
        {data && view && (
          <ComposerSettings
            data={data}
            view={view}
            disabled={busy}
            onChanged={reload}
            onError={setError}
            onSavingChange={setSettingsSaving}
          />
        )}
      </form>
    </section>
  );
}
