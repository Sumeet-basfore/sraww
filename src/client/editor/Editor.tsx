import '@excalidraw/excalidraw/index.css';
import {
  Excalidraw,
  loadLibraryFromBlob,
  restore,
  serializeLibraryAsJSON,
} from '@excalidraw/excalidraw';
import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types';
import { useEffect, useRef, useState } from 'react';
import { diagramApi } from '../lib/api.ts';
import { editorHash } from '../lib/route.ts';
import { IMPORT_ACCEPT, readDrawingFile, uniqueName } from '../diagrams/import.ts';
import { errorMessage } from '../lib/errors.ts';
import { loadPrefs, roughnessFor, savePrefs, type DrawingStyle, type Prefs } from '../lib/prefs.ts';
import type { ExcalidrawScene } from '../../shared/diagram.ts';
import { createAutosave, type Autosave, type SaveStatus } from './autosave.ts';
import { ArchPanel } from '../arch/ArchPanel.tsx';
import { Logo } from '../brand/Logo.tsx';
import { Assistant } from '../ai/assistant/Assistant.tsx';
import { downloadBlob, exportScene, type ExportFormat } from './export.ts';
import { createLibrarySync, type LibrarySync } from './library-sync.ts';
import { SaveIndicator } from './SaveIndicator.tsx';
import { sceneFingerprint, toSavedScene } from './scene.ts';
import { attachWheelZoom } from './wheel-zoom.ts';

export const AUTOSAVE_DELAY_MS = 800;

// Loading a file from Excalidraw's own menu would replace this drawing and autosave would then
// write the replacement here. Importing goes through the app instead, which creates a new drawing.
const LIBRARY_SAVE_DELAY_MS = 600;
const UI_OPTIONS = { canvasActions: { loadScene: false } } as const;

type RestoredScene = ReturnType<typeof restore>;
type LoadState =
  | { kind: 'loading' }
  | { kind: 'ready'; initial: RestoredScene; autosave: Autosave<ExcalidrawScene> }
  | { kind: 'failed'; message: string };

interface EditorProps {
  name: string;
  onExit: () => void;
  /** 'architecture' opens the map with its side panel. */
  mode?: 'diagram' | 'architecture';
  /** Reopens the walkthrough. The button is shown only when this is given. */
  onShowTour?: () => void;
}

/** The server validated the file; restore() performs Excalidraw's own normalization. */
function restoreScene(scene: ExcalidrawScene, style: DrawingStyle): RestoredScene {
  const input = scene as unknown as Parameters<typeof restore>[0];
  const restored = restore(input, null, null);
  return {
    ...restored,
    appState: { ...restored.appState, currentItemRoughness: roughnessFor(style) },
  };
}

export function Editor({ name, onExit, mode = 'diagram', onShowTour }: EditorProps) {
  const [load, setLoad] = useState<LoadState>({ kind: 'loading' });
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('saved');
  const [prefs, setPrefs] = useState<Prefs>(loadPrefs);
  const [actionError, setActionError] = useState<string | null>(null);
  const [panel, setPanel] = useState<'arch' | null>(mode === 'architecture' ? 'arch' : null);
  const [assistantOpen, setAssistantOpen] = useState(true);
  const apiRef = useRef<ExcalidrawImperativeAPI | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const drawingInput = useRef<HTMLInputElement>(null);
  const libraryInput = useRef<HTMLInputElement>(null);
  const librarySyncRef = useRef<LibrarySync | null>(null);

  useEffect(() => {
    const sync = createLibrarySync({ delayMs: LIBRARY_SAVE_DELAY_MS, onError: setActionError });
    librarySyncRef.current = sync;
    return () => {
      sync.dispose();
      librarySyncRef.current = null;
    };
  }, []);

  useEffect(() => {
    const element = canvasRef.current;
    if (!element) return undefined;
    const detachWheel = attachWheelZoom(element);
    // Excalidraw would load a dropped .excalidraw file over this drawing. Catch those drops here,
    // in the capture phase, and import them as new drawings or into the library instead.
    function onDrop(event: DragEvent): void {
      const file = event.dataTransfer?.files[0];
      if (!file) return;
      const name = file.name.toLowerCase();
      const isLibrary = name.endsWith('.excalidrawlib');
      const isDrawing = name.endsWith('.excalidraw') || name.endsWith('.json');
      if (!isLibrary && !isDrawing) return;
      event.preventDefault();
      event.stopPropagation();
      if (isLibrary) void importLibraryRef.current(file);
      else void importDrawingRef.current(file);
    }
    element.addEventListener('drop', onDrop, true);
    return () => {
      detachWheel();
      element.removeEventListener('drop', onDrop, true);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoad({ kind: 'loading' });
    setSaveStatus('saved');

    const autosave = createAutosave<ExcalidrawScene>({
      save: (scene) => diagramApi.save(name, scene),
      fingerprint: (scene) => sceneFingerprint(scene.elements),
      delayMs: AUTOSAVE_DELAY_MS,
      onStatusChange: (status) => {
        if (!cancelled) setSaveStatus(status);
      },
    });

    diagramApi
      .read(name)
      .then((scene) => {
        if (cancelled) return;
        const initial = restoreScene(scene, loadPrefs().drawingStyle);
        autosave.reset(toSavedScene(initial.elements, initial.appState, initial.files));
        setLoad({ kind: 'ready', initial, autosave });
      })
      .catch((err: unknown) => {
        if (!cancelled) setLoad({ kind: 'failed', message: errorMessage(err) });
      });

    return () => {
      cancelled = true;
      // Save anything still pending for this diagram before the editor goes away.
      void autosave.flush();
      autosave.dispose();
    };
  }, [name]);

  useEffect(() => {
    function warnBeforeLeaving(event: BeforeUnloadEvent): void {
      if (load.kind !== 'ready' || !load.autosave.hasUnsavedChanges()) return;
      event.preventDefault();
    }
    window.addEventListener('beforeunload', warnBeforeLeaving);
    return () => window.removeEventListener('beforeunload', warnBeforeLeaving);
  }, [load]);

  useEffect(() => {
    document.documentElement.dataset.theme = prefs.theme;
  }, [prefs.theme]);

  async function handleExit(): Promise<void> {
    if (load.kind !== 'ready') return onExit();
    const saved = await load.autosave.flush();
    if (saved) onExit();
  }

  function updateStyle(style: DrawingStyle): void {
    const next = { ...prefs, drawingStyle: style };
    setPrefs(next);
    savePrefs(next);
    apiRef.current?.updateScene({ appState: { currentItemRoughness: roughnessFor(style) } });
  }

  async function handleExport(format: ExportFormat): Promise<void> {
    const api = apiRef.current;
    if (!api) return;
    setActionError(null);
    try {
      await exportScene(
        format,
        {
          elements: api.getSceneElements(),
          appState: api.getAppState(),
          files: api.getFiles(),
        },
        name,
      );
    } catch (err) {
      setActionError(`Export failed. ${errorMessage(err)}`);
    }
  }

  async function importDrawing(file: File): Promise<void> {
    setActionError(null);
    try {
      const drawing = await readDrawingFile(file);
      const existing = (await diagramApi.list()).map((item) => item.name);
      const created = uniqueName(drawing.name, existing);
      await diagramApi.create(created, drawing.scene);
      window.location.hash = editorHash(created);
    } catch (err) {
      setActionError(`Import failed. ${errorMessage(err)}`);
    }
  }

  async function importLibrary(file: File): Promise<void> {
    const api = apiRef.current;
    if (!api) return;
    setActionError(null);
    try {
      const libraryItems = await loadLibraryFromBlob(file);
      await api.updateLibrary({ libraryItems, merge: true, prompt: false, openLibraryMenu: true });
    } catch (err) {
      setActionError(`Library import failed. ${errorMessage(err)}`);
    }
  }

  function exportLibrary(): void {
    const items = librarySyncRef.current?.current() ?? [];
    const json = serializeLibraryAsJSON(items as never);
    downloadBlob(new Blob([json], { type: 'application/json' }), 'sraww-library.excalidrawlib');
  }

  function runFileAction(action: string): void {
    if (action === 'import-drawing') drawingInput.current?.click();
    else if (action === 'import-library') libraryInput.current?.click();
    else if (action === 'export-library') exportLibrary();
    else if (action) void handleExport(action as ExportFormat);
  }

  /** Adds the saved library to Excalidraw's own library, which it keeps in this browser. */
  async function seedLibrary(api: ExcalidrawImperativeAPI): Promise<void> {
    try {
      const saved = (await librarySyncRef.current?.initial()) ?? [];
      if (saved.length === 0) return;
      await api.updateLibrary({ libraryItems: saved as never, merge: true, prompt: false });
    } catch (err) {
      setActionError(`The library could not be added to the editor. ${errorMessage(err)}`);
    }
  }

  // The drop handler is attached once, so it calls the latest import functions through refs.
  const importDrawingRef = useRef<(file: File) => Promise<void>>(async () => undefined);
  const importLibraryRef = useRef<(file: File) => Promise<void>>(async () => undefined);
  importDrawingRef.current = importDrawing;
  importLibraryRef.current = importLibrary;

  function toggleTheme(): void {
    const next = {
      ...prefs,
      theme: prefs.theme === 'dark' ? ('light' as const) : ('dark' as const),
    };
    setPrefs(next);
    savePrefs(next);
  }

  return (
    <div className="editor">
      <header className="editor-bar">
        <Logo variant="symbol" className="brand-symbol" />
        <button type="button" className="button ghost" onClick={() => void handleExit()}>
          ← Diagrams
        </button>
        <h1 className="editor-title" title={name}>
          {name}
        </h1>
        {load.kind === 'ready' && (
          <SaveIndicator status={saveStatus} onRetry={() => void load.autosave.flush()} />
        )}
        <div className="segmented" role="radiogroup" aria-label="Drawing style">
          {(['hand', 'clean'] as const).map((style) => (
            <button
              key={style}
              type="button"
              role="radio"
              aria-checked={prefs.drawingStyle === style}
              className={prefs.drawingStyle === style ? 'active' : ''}
              onClick={() => updateStyle(style)}
            >
              {style === 'hand' ? 'Hand-drawn' : 'Clean'}
            </button>
          ))}
        </div>
        {onShowTour && (
          <button type="button" className="button ghost" onClick={onShowTour}>
            Tour
          </button>
        )}
        {mode === 'architecture' && (
          <button
            type="button"
            className="button ghost"
            aria-expanded={panel === 'arch'}
            disabled={load.kind !== 'ready'}
            onClick={() => setPanel((open) => (open === 'arch' ? null : 'arch'))}
          >
            Architecture
          </button>
        )}
        <select
          className="export-select"
          aria-label="File actions"
          value=""
          disabled={load.kind !== 'ready'}
          onChange={(e) => {
            const action = e.target.value;
            e.target.value = '';
            runFileAction(action);
          }}
        >
          <option value="">File…</option>
          <option value="png">Export PNG image</option>
          <option value="svg">Export SVG image</option>
          <option value="excalidraw">Export .excalidraw file</option>
          <option value="import-drawing">Import .excalidraw file as new drawing…</option>
          <option value="import-library">Import library (.excalidrawlib)…</option>
          <option value="export-library">Export library (.excalidrawlib)</option>
        </select>
        <input
          ref={drawingInput}
          type="file"
          accept={IMPORT_ACCEPT}
          hidden
          aria-label="Choose a drawing to import"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = '';
            if (file) void importDrawing(file);
          }}
        />
        <input
          ref={libraryInput}
          type="file"
          accept=".excalidrawlib,.json,application/json"
          hidden
          aria-label="Choose a library to import"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = '';
            if (file) void importLibrary(file);
          }}
        />
        <button type="button" className="button ghost" onClick={toggleTheme}>
          {prefs.theme === 'dark' ? 'Light' : 'Dark'} mode
        </button>
      </header>

      {actionError && (
        <p role="alert" className="banner error export-error">
          {actionError}
        </p>
      )}

      <div className="editor-canvas" ref={canvasRef}>
        {load.kind === 'loading' && <p className="muted pad">Opening {name}…</p>}
        {load.kind === 'failed' && (
          <div className="pad">
            <p role="alert" className="banner error">
              Could not open “{name}”. {load.message}
            </p>
            <button type="button" className="button" onClick={onExit}>
              Back to diagrams
            </button>
          </div>
        )}
        {load.kind === 'ready' && (
          <Excalidraw
            key={name}
            initialData={load.initial}
            theme={prefs.theme}
            aiEnabled={false}
            UIOptions={UI_OPTIONS}
            onLibraryChange={(items) => librarySyncRef.current?.changed(items)}
            excalidrawAPI={(api) => {
              apiRef.current = api;
              void seedLibrary(api);
            }}
            onChange={(elements, appState, files) =>
              load.autosave.update(toSavedScene(elements, appState, files))
            }
          />
        )}
        {panel === 'arch' && load.kind === 'ready' && (
          <ArchPanel name={name} getApi={() => apiRef.current} onClose={() => setPanel(null)} />
        )}
      </div>
      {load.kind === 'ready' && (
        <Assistant
          getApi={() => apiRef.current}
          open={assistantOpen}
          onToggle={() => setAssistantOpen((open) => !open)}
        />
      )}
    </div>
  );
}
