import { useCallback, useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { diagramApi, type DiagramSummary } from '../lib/api.ts';
import { errorMessage } from '../lib/errors.ts';
import { diagramNameError, diagramNameSchema } from '../../shared/diagram.ts';
import { ArchNewForm } from '../arch/ArchNewForm.tsx';
import { Logo } from '../brand/Logo.tsx';
import { ProjectsSection } from '../projects/ProjectsSection.tsx';
import { IMPORT_ACCEPT, readDrawingFile, uniqueName } from './import.ts';
import { useAiProviders } from '../ai/useAiProviders.ts';
import { defaultView, isReady } from '../ai/toolSummary.ts';
import './start.css';

interface DiagramListProps {
  onOpen: (name: string) => void;
  onOpenArchitecture: (name: string) => void;
  onOpenAi: () => void;
  /** Reopens the walkthrough. The button is shown only when this is given. */
  onShowTour?: () => void;
}

function countLabel(count: number): string {
  return `${count} drawing${count === 1 ? '' : 's'}`;
}

export function DiagramList({
  onOpen,
  onOpenArchitecture,
  onOpenAi,
  onShowTour,
}: DiagramListProps) {
  const [items, setItems] = useState<DiagramSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [busy, setBusy] = useState(false);
  // Bumped after a project is added or removed, so the architecture form lists the change.
  const [projectsVersion, setProjectsVersion] = useState(0);
  const fileInput = useRef<HTMLInputElement>(null);
  const { state: providersState } = useAiProviders();

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
    if (!diagramNameSchema.safeParse(name).success) {
      setError(diagramNameError);
      return;
    }
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

  const defaultTool = providersState.status === 'ready' ? defaultView(providersState.data) : null;
  const aiStatus =
    providersState.status === 'error'
      ? 'AI status unavailable'
      : providersState.status === 'loading'
        ? 'Checking AI status…'
        : defaultTool
          ? isReady(defaultTool)
            ? `${defaultTool.id === 'claude' ? 'Claude' : 'Codex'} ready`
            : defaultTool.installed
              ? 'Sign in needed'
              : `${defaultTool.id === 'claude' ? 'Claude' : 'Codex'} unavailable`
          : 'AI status unavailable';

  return (
    <section className="diagram-list start-page" aria-labelledby="diagram-list-title">
      <header className="masthead">
        <Logo className="brand-lockup" />
        <div className="masthead-links">
          {onShowTour && (
            <button type="button" className="link-button" onClick={onShowTour}>
              Take the tour
            </button>
          )}
          <button type="button" className="link-button" onClick={onOpenAi}>
            AI tools
          </button>
          <span className="ai-status" role="status" aria-label="Default AI tool status">
            {aiStatus}
          </span>
        </div>
      </header>

      <div className="start-columns">
        <section className="start-diagrams" aria-label="Diagrams">
          <div className="intro">
            <h1 id="diagram-list-title">Diagrams</h1>
            {items && <p className="meta">{countLabel(items.length)}</p>}
          </div>

          <form className="new-diagram" onSubmit={handleCreate}>
            <label htmlFor="new-diagram-name" className="visually-hidden">
              New diagram name
            </label>
            <input
              id="new-diagram-name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Name a new drawing"
              disabled={busy}
            />
            <button type="submit" className="button primary" disabled={busy || !newName.trim()}>
              Create
            </button>
          </form>

          <div className="import-row">
            <button
              type="button"
              className="link-button"
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
            <p className="empty">Nothing drawn yet. Name a drawing above to start.</p>
          )}

          {items && items.length > 0 && (
            <ul className="rows">
              {items.map((item) => (
                <li key={item.name} className="row">
                  <button type="button" className="row-title" onClick={() => onOpen(item.name)}>
                    {item.name}
                  </button>
                  <span className="row-meta">
                    Updated {new Date(item.updatedAt).toLocaleString()}
                  </span>
                  <span className="row-actions">
                    <button
                      type="button"
                      className="button ghost icon-button"
                      aria-label={`Rename ${item.name}`}
                      title="Rename"
                      onClick={() => handleRename(item)}
                    >
                      <svg viewBox="0 0 24 24" aria-hidden="true">
                        <path d="m14.5 5.5 4 4M4 20l4.2-.8L19 8.4a2.1 2.1 0 0 0-3-3L5.2 16.2 4 20Z" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      className="button ghost icon-button"
                      aria-label={`Duplicate ${item.name}`}
                      title="Duplicate"
                      onClick={() => handleDuplicate(item)}
                    >
                      <svg viewBox="0 0 24 24" aria-hidden="true">
                        <rect x="8" y="8" width="12" height="12" rx="2" />
                        <path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      className="button ghost danger icon-button"
                      aria-label={`Delete ${item.name}`}
                      title="Delete"
                      onClick={() => handleDelete(item)}
                    >
                      <svg viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M4 7h16M10 11v6m4-6v6M6 7l1 13h10l1-13M9 7V4h6v3" />
                      </svg>
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <div className="start-tools">
          <ProjectsSection onChanged={() => setProjectsVersion((v) => v + 1)} />
          <ArchNewForm
            key={projectsVersion}
            existingNames={(items ?? []).map((item) => item.name)}
            onOpen={onOpenArchitecture}
          />
        </div>
      </div>
    </section>
  );
}
