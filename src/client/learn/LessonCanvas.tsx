import '@excalidraw/excalidraw/index.css';
import { CaptureUpdateAction, Excalidraw, MainMenu } from '@excalidraw/excalidraw';
import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { LessonReply } from '../../shared/learn.ts';
import { type Layout, layoutGraph } from '../ai/layout.ts';
import { DRAWING_UI_OPTIONS } from '../editor/drawing-options.ts';
import { ProjectMenuLinks } from '../editor/ProjectMenuLinks.tsx';
import { loadPrefs } from '../lib/prefs.ts';
import { BuildControls } from './BuildControls.tsx';
import { planBuild } from './build-steps.ts';
import { sceneElements, type SceneElements } from './lesson-scene.ts';
import { initialPlayback } from './playback.ts';
import { usePlayback, usePrefersReducedMotion } from './usePlayback.ts';

interface LessonCanvasProps {
  diagram: LessonReply['diagram'];
}

type Drawing =
  | { status: 'drawing' }
  | { status: 'ready'; layout: Layout; initial: SceneElements; full: SceneElements }
  | { status: 'failed' };

const MIN_ZOOM = 0.1;
// Keep the buttons in sync with Excalidraw's Ctrl-wheel limit.
const MAX_ZOOM = 30;
const ZOOM_STEP = 1.2;

function normalizeZoom(value: number): number {
  // Excalidraw rounds normalized zoom values to six decimal places before clamping.
  const rounded = Math.round(value * 1_000_000) / 1_000_000;
  return Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, rounded));
}

/** The lesson drawn read-only, built up one step at a time with the controls below it. */
export function LessonCanvas({ diagram }: LessonCanvasProps) {
  const steps = useMemo(() => planBuild(diagram), [diagram]);
  const reducedMotion = usePrefersReducedMotion();
  const startShown = initialPlayback({ total: steps.length, reducedMotion }).shown;
  const [drawing, setDrawing] = useState<Drawing>({ status: 'drawing' });
  const [api, setApi] = useState<ExcalidrawImperativeAPI | null>(null);
  const playback = usePlayback({
    total: steps.length,
    reducedMotion,
    ready: drawing.status === 'ready',
  });
  // The step the canvas shows. The canvas mounts with `startShown`, so updates start from there.
  const shownOnCanvas = useRef(startShown);
  const wheelZoomIntent = useRef<(() => void) | null>(null);
  const registerWheelZoomIntent = useCallback((handler: (() => void) | null): void => {
    wheelZoomIntent.current = handler;
  }, []);

  useEffect(() => {
    if (!api || drawing.status !== 'ready' || playback.shown === shownOnCanvas.current) return;
    shownOnCanvas.current = playback.shown;
    api.updateScene({
      elements: sceneElements(diagram, drawing.layout, steps, playback.shown),
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    });
  }, [api, drawing, diagram, steps, playback.shown]);

  useEffect(() => {
    let cancelled = false;
    async function draw(): Promise<void> {
      try {
        const layout = await layoutGraph(diagram);
        const next: Drawing = {
          status: 'ready',
          layout,
          initial: sceneElements(diagram, layout, steps, startShown),
          full: sceneElements(diagram, layout, steps, steps.length),
        };
        if (!cancelled) setDrawing(next);
      } catch {
        if (!cancelled) setDrawing({ status: 'failed' });
      }
    }
    void draw();
    return () => {
      cancelled = true;
    };
  }, [diagram, steps, startShown]);

  return (
    <>
      <div
        className="lesson-canvas"
        onWheelCapture={(event) => {
          const target = event.target;
          const isDrawingSurface =
            target instanceof HTMLCanvasElement || target instanceof HTMLTextAreaElement;
          if (!isDrawingSurface) return;
          if (event.ctrlKey || event.metaKey) {
            wheelZoomIntent.current?.();
            return;
          }
          // Keep plain wheel scrolling on the lesson page; Ctrl-wheel still reaches Excalidraw.
          event.stopPropagation();
        }}
      >
        {drawing.status === 'ready' && (
          <Excalidraw
            initialData={{ elements: drawing.initial }}
            viewModeEnabled
            aiEnabled={false}
            UIOptions={DRAWING_UI_OPTIONS}
            theme={loadPrefs().theme}
            excalidrawAPI={setApi}
          >
            <MainMenu>
              <MainMenu.DefaultItems.ChangeCanvasBackground />
              <MainMenu.DefaultItems.ClearCanvas />
              <ProjectMenuLinks />
            </MainMenu>
          </Excalidraw>
        )}
        {drawing.status === 'drawing' && (
          <p className="lesson-canvas-status muted" role="status">
            Drawing the lesson…
          </p>
        )}
        {drawing.status === 'failed' && (
          <p className="lesson-canvas-status banner error" role="alert">
            The drawing could not be made.
          </p>
        )}
      </div>
      {drawing.status === 'ready' && (
        <div className="lesson-canvas-actions">
          {api && (
            <LessonZoomControls
              api={api}
              full={drawing.full}
              onRegisterWheelZoomIntent={registerWheelZoomIntent}
            />
          )}
          <BuildControls
            shown={playback.shown}
            total={steps.length}
            playing={playback.playing}
            reducedMotion={reducedMotion}
            dispatch={playback.dispatch}
          />
        </div>
      )}
    </>
  );
}

interface LessonZoomControlsProps {
  api: ExcalidrawImperativeAPI;
  full: SceneElements;
  onRegisterWheelZoomIntent: (handler: (() => void) | null) => void;
}

function LessonZoomControls({ api, full, onRegisterWheelZoomIntent }: LessonZoomControlsProps) {
  const [zoomValue, setZoomValue] = useState(() => api.getAppState().zoom.value);
  const [announcement, setAnnouncement] = useState('');
  const announcementFrame = useRef<number | null>(null);
  const fitTimer = useRef<number | null>(null);
  const fitFrame = useRef<number | null>(null);
  const announcementTimer = useRef<number | null>(null);
  const suppressAnnouncement = useRef(false);
  const suppressTimer = useRef<number | null>(null);
  const lastZoom = useRef<number | null>(null);

  const announce = useCallback((message: string): void => {
    if (announcementTimer.current !== null) {
      window.clearTimeout(announcementTimer.current);
      announcementTimer.current = null;
    }
    setAnnouncement('');
    if (announcementFrame.current !== null) {
      window.cancelAnimationFrame(announcementFrame.current);
    }
    announcementFrame.current = window.requestAnimationFrame(() => {
      setAnnouncement(message);
      announcementFrame.current = null;
    });
  }, []);

  const suppressNextScrollAnnouncement = useCallback((): void => {
    suppressAnnouncement.current = true;
    if (suppressTimer.current !== null) window.clearTimeout(suppressTimer.current);
    suppressTimer.current = window.setTimeout(() => {
      suppressAnnouncement.current = false;
      suppressTimer.current = null;
    }, 500);
  }, []);

  const clearPendingScrollAnnouncement = useCallback((): void => {
    suppressAnnouncement.current = false;
    if (suppressTimer.current !== null) window.clearTimeout(suppressTimer.current);
    suppressTimer.current = null;
  }, []);

  const cancelPendingFit = useCallback((): void => {
    if (fitTimer.current !== null) window.clearTimeout(fitTimer.current);
    fitTimer.current = null;
    if (fitFrame.current !== null) window.cancelAnimationFrame(fitFrame.current);
    fitFrame.current = null;
  }, []);

  const handleWheelZoomIntent = useCallback((): void => {
    cancelPendingFit();
    clearPendingScrollAnnouncement();
  }, [cancelPendingFit, clearPendingScrollAnnouncement]);

  useEffect(() => {
    onRegisterWheelZoomIntent(handleWheelZoomIntent);
    return () => onRegisterWheelZoomIntent(null);
  }, [handleWheelZoomIntent, onRegisterWheelZoomIntent]);

  useEffect(() => {
    const initialZoom = api.getAppState().zoom.value;
    lastZoom.current = initialZoom;
    setZoomValue(initialZoom);
    return api.onScrollChange((_scrollX, _scrollY, zoom) => {
      const changed = lastZoom.current !== zoom.value;
      lastZoom.current = zoom.value;
      setZoomValue((current) => (current === zoom.value ? current : zoom.value));
      if (suppressAnnouncement.current) {
        clearPendingScrollAnnouncement();
        return;
      }
      if (!changed) return;
      cancelPendingFit();
      if (announcementTimer.current !== null) window.clearTimeout(announcementTimer.current);
      announcementTimer.current = window.setTimeout(() => {
        announce(`Zoom ${Math.round(zoom.value * 100)} percent.`);
        announcementTimer.current = null;
      }, 250);
    });
  }, [api, announce, cancelPendingFit, clearPendingScrollAnnouncement]);

  useEffect(() => {
    if (full.length === 0) return undefined;
    fitTimer.current = window.setTimeout(() => {
      fitTimer.current = null;
      // Fit the whole scene once so later playback steps remain in frame.
      suppressNextScrollAnnouncement();
      api.scrollToContent(full, { fitToContent: true });
      fitFrame.current = window.requestAnimationFrame(() => {
        fitFrame.current = null;
        const nextZoom = api.getAppState().zoom.value;
        lastZoom.current = nextZoom;
        setZoomValue(nextZoom);
        clearPendingScrollAnnouncement();
      });
    }, 300);
    return () => {
      cancelPendingFit();
    };
  }, [api, full, cancelPendingFit, clearPendingScrollAnnouncement, suppressNextScrollAnnouncement]);

  useEffect(
    () => () => {
      if (announcementFrame.current !== null) {
        window.cancelAnimationFrame(announcementFrame.current);
      }
      cancelPendingFit();
      if (announcementTimer.current !== null) window.clearTimeout(announcementTimer.current);
      clearPendingScrollAnnouncement();
    },
    [cancelPendingFit, clearPendingScrollAnnouncement],
  );

  function changeZoom(factor: number): void {
    const state = api.getAppState();
    const currentZoom = state.zoom.value;
    if (factor > 1 && currentZoom >= MAX_ZOOM) {
      announce(`Maximum zoom reached at ${Math.round(currentZoom * 100)} percent.`);
      return;
    }
    if (factor < 1 && currentZoom <= MIN_ZOOM) {
      announce(`Minimum zoom reached at ${Math.round(currentZoom * 100)} percent.`);
      return;
    }

    const nextZoom = normalizeZoom(currentZoom * factor) as typeof state.zoom.value;
    if (nextZoom === currentZoom) return;

    cancelPendingFit();
    suppressNextScrollAnnouncement();

    const centerSceneX = state.width / (2 * currentZoom) - state.scrollX;
    const centerSceneY = state.height / (2 * currentZoom) - state.scrollY;
    api.updateScene({
      appState: {
        zoom: { value: nextZoom },
        scrollX: state.width / (2 * nextZoom) - centerSceneX,
        scrollY: state.height / (2 * nextZoom) - centerSceneY,
      },
      captureUpdate: CaptureUpdateAction.NEVER,
    });
    lastZoom.current = nextZoom;
    setZoomValue(nextZoom);
    announce(`Zoom ${Math.round(nextZoom * 100)} percent.`);
  }

  function fitDiagram(): void {
    cancelPendingFit();
    const elements = api.getSceneElements();
    if (elements.length === 0) {
      announce('There are no visible diagram elements to fit yet.');
      return;
    }
    suppressNextScrollAnnouncement();
    api.scrollToContent(elements, { fitToContent: true });
    fitFrame.current = window.requestAnimationFrame(() => {
      fitFrame.current = null;
      const nextZoom = api.getAppState().zoom.value;
      lastZoom.current = nextZoom;
      setZoomValue(nextZoom);
      clearPendingScrollAnnouncement();
      announce(`Current step fitted to ${Math.round(nextZoom * 100)} percent.`);
    });
  }

  return (
    <>
      <div className="lesson-zoom-controls" role="group" aria-label="Diagram zoom controls">
        <button
          type="button"
          className="button small"
          aria-label="Zoom out −"
          aria-disabled={zoomValue <= MIN_ZOOM}
          title="Zoom out"
          onClick={() => changeZoom(1 / ZOOM_STEP)}
        >
          −
        </button>
        <span
          className="lesson-zoom-level"
          role="meter"
          aria-label="Zoom level"
          aria-valuemin={MIN_ZOOM * 100}
          aria-valuemax={MAX_ZOOM * 100}
          aria-valuenow={Math.round(zoomValue * 100)}
        >
          {`${Math.round(zoomValue * 100)}%`}
        </span>
        <button
          type="button"
          className="button small"
          aria-label="Zoom in +"
          aria-disabled={zoomValue >= MAX_ZOOM}
          title="Zoom in"
          onClick={() => changeZoom(ZOOM_STEP)}
        >
          +
        </button>
        <button
          type="button"
          className="button small lesson-zoom-fit"
          aria-label="Fit step to canvas"
          title="Fit current step to canvas"
          onClick={fitDiagram}
        >
          Fit step
        </button>
      </div>
      <p role="status" className="visually-hidden" aria-live="polite">
        {announcement}
      </p>
    </>
  );
}
