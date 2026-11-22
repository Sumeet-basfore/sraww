import '@excalidraw/excalidraw/index.css';
import { Excalidraw, restore } from '@excalidraw/excalidraw';
import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types';
import { useEffect, useRef, useState } from 'react';
import { diagramApi } from '../lib/api.ts';
import { errorMessage } from '../lib/errors.ts';
import { loadPrefs, roughnessFor, savePrefs, type DrawingStyle, type Prefs } from '../lib/prefs.ts';
import type { ExcalidrawScene } from '../../shared/diagram.ts';
import { createAutosave, type Autosave, type SaveStatus } from './autosave.ts';
import { ArchPanel } from '../arch/ArchPanel.tsx';
import { ChatPanel } from '../ai/ChatPanel.tsx';
import { GeneratePanel } from '../ai/GeneratePanel.tsx';
import { exportScene, type ExportFormat } from './export.ts';
import { SaveIndicator } from './SaveIndicator.tsx';
import { sceneFingerprint, toSavedScene } from './scene.ts';

export const AUTOSAVE_DELAY_MS = 800;

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

export function Editor({ name, onExit, mode = 'diagram' }: EditorProps) {
  const [load, setLoad] = useState<LoadState>({ kind: 'loading' });
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('saved');
  const [prefs, setPrefs] = useState<Prefs>(loadPrefs);
  const [exportError, setExportError] = useState<string | null>(null);
  const [panel, setPanel] = useState<'arch' | 'generate' | 'chat' | null>(
    mode === 'architecture' ? 'arch' : null,
  );
  const apiRef = useRef<ExcalidrawImperativeAPI | null>(null);

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
    setExportError(null);
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
      setExportError(`Export failed. ${errorMessage(err)}`);
    }
  }

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
        {(['generate', 'chat'] as const).map((which) => (
          <button
            key={which}
            type="button"
            className="button ghost"
            aria-expanded={panel === which}
            disabled={load.kind !== 'ready'}
            onClick={() => setPanel((open) => (open === which ? null : which))}
          >
            {which === 'generate' ? '✦ Generate' : 'Chat'}
          </button>
        ))}
        <select
          className="export-select"
          aria-label="Export drawing"
          value=""
          disabled={load.kind !== 'ready'}
          onChange={(e) => {
            const format = e.target.value as ExportFormat;
            if (format) void handleExport(format);
          }}
        >
          <option value="">Export…</option>
          <option value="png">PNG image</option>
          <option value="svg">SVG image</option>
          <option value="excalidraw">Excalidraw file</option>
        </select>
        <button type="button" className="button ghost" onClick={toggleTheme}>
          {prefs.theme === 'dark' ? 'Light' : 'Dark'} mode
        </button>
      </header>

      {exportError && (
        <p role="alert" className="banner error export-error">
          {exportError}
        </p>
      )}

      <div className="editor-canvas">
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
            excalidrawAPI={(api) => {
              apiRef.current = api;
            }}
            onChange={(elements, appState, files) =>
              load.autosave.update(toSavedScene(elements, appState, files))
            }
          />
        )}
        {panel !== null &&
          load.kind === 'ready' &&
          (panel === 'arch' ? (
            <ArchPanel name={name} getApi={() => apiRef.current} onClose={() => setPanel(null)} />
          ) : panel === 'generate' ? (
            <GeneratePanel getApi={() => apiRef.current} onClose={() => setPanel(null)} />
          ) : (
            <ChatPanel getApi={() => apiRef.current} onClose={() => setPanel(null)} />
          ))}
      </div>
    </div>
  );
}
