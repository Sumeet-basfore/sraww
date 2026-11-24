import '@excalidraw/excalidraw/index.css';
import { convertToExcalidrawElements, Excalidraw, MainMenu } from '@excalidraw/excalidraw';
import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types';
import { useEffect, useState } from 'react';
import type { LessonReply } from '../../shared/learn.ts';
import { layoutGraph } from '../ai/layout.ts';
import { graphToSkeleton } from '../ai/skeleton.ts';
import { DRAWING_UI_OPTIONS } from '../editor/drawing-options.ts';
import { ProjectMenuLinks } from '../editor/ProjectMenuLinks.tsx';
import { loadPrefs } from '../lib/prefs.ts';

interface LessonCanvasProps {
  diagram: LessonReply['diagram'];
}

type Elements = ReturnType<typeof convertToExcalidrawElements>;

type Drawing =
  { status: 'drawing' } | { status: 'ready'; elements: Elements } | { status: 'failed' };

export function LessonCanvas({ diagram }: LessonCanvasProps) {
  const [drawing, setDrawing] = useState<Drawing>({ status: 'drawing' });
  const [api, setApi] = useState<ExcalidrawImperativeAPI | null>(null);

  // The canvas measures itself after it mounts, so the fit waits briefly, as the architecture view does.
  useEffect(() => {
    if (!api || drawing.status !== 'ready') return undefined;
    const elements = drawing.elements;
    const timer = window.setTimeout(
      () => api.scrollToContent(elements, { fitToContent: true }),
      300,
    );
    return () => window.clearTimeout(timer);
  }, [api, drawing]);

  useEffect(() => {
    let cancelled = false;
    async function draw(): Promise<void> {
      try {
        const layout = await layoutGraph(diagram);
        const elements = convertToExcalidrawElements(graphToSkeleton(diagram, layout), {
          regenerateIds: true,
        });
        if (!cancelled) setDrawing({ status: 'ready', elements });
      } catch {
        if (!cancelled) setDrawing({ status: 'failed' });
      }
    }
    void draw();
    return () => {
      cancelled = true;
    };
  }, [diagram]);

  return (
    <div className="lesson-canvas">
      {drawing.status === 'ready' && (
        <Excalidraw
          initialData={{ elements: drawing.elements }}
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
  );
}
