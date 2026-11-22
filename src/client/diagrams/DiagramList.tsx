import { useCallback, useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { diagramApi, type DiagramSummary } from '../lib/api.ts';
import { errorMessage } from '../lib/errors.ts';
import { IMPORT_ACCEPT, readDrawingFile, uniqueName } from './import.ts';

interface DiagramListProps {
  onOpen: (name: string) => void;
}

export function DiagramList({ onOpen }: DiagramListProps) {
  const [items, setItems] = useState<DiagramSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [busy, setBusy] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const refresh = useCallback(async () => {
    try {
      setItems(await diagramApi.list());
      setError(null);
    } catch (err) {
      setError(errorMessage(err));
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function runAndRefresh(action: () => Promise<unknown>): Promise<void> {
    setBusy(true);
    try {
      await action();
      await refresh();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleCreate(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const name = newName.trim();
    if (!name) return;
    setBusy(true);
    try {
      await diagramApi.create(name);
      setNewName('');
      onOpen(name);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleImport(event: ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !items) return;
    setBusy(true);
    try {
      const drawing = await readDrawingFile(file);
      const name = uniqueName(
        drawing.name,
        items.map((item) => item.name),
      );
      await diagramApi.create(name, drawing.scene);
      onOpen(name);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  function handleRename(item: DiagramSummary): void {
    const next = window.prompt('Rename diagram', item.name)?.trim();
    if (!next || next === item.name) return;
    void runAndRefresh(() => diagramApi.rename(item.name, next));
  }

  function handleDuplicate(item: DiagramSummary): void {
    const copy = window.prompt('Name for the copy', `${item.name} copy`)?.trim();
    if (!copy) return;
    void runAndRefresh(() => diagramApi.duplicate(item.name, copy));
  }

  function handleDelete(item: DiagramSummary): void {
    if (!window.confirm(`Delete "${item.name}"? This cannot be undone.`)) return;
    void runAndRefresh(() => diagramApi.remove(item.name));
  }

  return (
    <section className="diagram-list" aria-labelledby="diagram-list-title">
      <header className="page-header">
        <p className="eyebrow">sraww</p>
        <h1 id="diagram-list-title">Diagrams</h1>
      </header>

      <form className="new-diagram" onSubmit={handleCreate}>
        <label htmlFor="new-diagram-name" className="visually-hidden">
          New diagram name
        </label>
        <input
          id="new-diagram-name"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="Name a new diagram"
          maxLength={81}
          disabled={busy}
        />
        <button type="submit" className="button primary" disabled={busy || !newName.trim()}>
          Create
        </button>
      </form>

      <div className="import-row">
        <button
          type="button"
          className="button ghost"
          disabled={busy || items === null}
          onClick={() => fileInput.current?.click()}
        >
          Import a .excalidraw file
        </button>
        <input
          ref={fileInput}
          type="file"
          accept={IMPORT_ACCEPT}
          onChange={(e) => void handleImport(e)}
          hidden
          aria-label="Choose a drawing to import"
        />
      </div>

      {error && (
        <p role="alert" className="banner error">
          {error}
        </p>
      )}

      {items === null && !error && <p className="muted">Loading…</p>}

      {items?.length === 0 && (
        <p className="empty">No diagrams yet. Name one above to start drawing.</p>
      )}

      {items && items.length > 0 && (
        <ul className="rows">
          {items.map((item) => (
            <li key={item.name} className="row">
              <button type="button" className="row-title" onClick={() => onOpen(item.name)}>
                {item.name}
              </button>
              <span className="row-meta">Updated {new Date(item.updatedAt).toLocaleString()}</span>
              <span className="row-actions">
                <button type="button" className="button ghost" onClick={() => handleRename(item)}>
                  Rename
                </button>
                <button
                  type="button"
                  className="button ghost"
                  onClick={() => handleDuplicate(item)}
                >
                  Duplicate
                </button>
                <button
                  type="button"
                  className="button ghost danger"
                  onClick={() => handleDelete(item)}
                >
                  Delete
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
