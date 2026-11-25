import '@excalidraw/excalidraw/index.css';
import { CaptureUpdateAction, Excalidraw, MainMenu } from '@excalidraw/excalidraw';
import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types';
import { useEffect, useMemo, useRef, useState } from 'react';
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

  // The canvas measures itself after it mounts, so the fit waits briefly, as the architecture view does.
  useEffect(() => {
    if (!api || drawing.status !== 'ready') return undefined;
    const full = drawing.full;
    const timer = window.setTimeout(() => api.scrollToContent(full, { fitToContent: true }), 300);
    return () => window.clearTimeout(timer);
  }, [api, drawing]);

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
      <div className="lesson-canvas">
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
        <BuildControls
          shown={playback.shown}
          total={steps.length}
          playing={playback.playing}
          reducedMotion={reducedMotion}
          dispatch={playback.dispatch}
        />
      )}
    </>
  );
}
