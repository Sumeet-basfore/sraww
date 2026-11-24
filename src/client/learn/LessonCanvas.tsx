import '@excalidraw/excalidraw/index.css';
import { convertToExcalidrawElements, Excalidraw } from '@excalidraw/excalidraw';
import { useEffect, useState } from 'react';
import type { LessonReply } from '../../shared/learn.ts';
import { layoutGraph } from '../ai/layout.ts';
import { graphToSkeleton } from '../ai/skeleton.ts';
import { loadPrefs } from '../lib/prefs.ts';

interface LessonCanvasProps {
  diagram: LessonReply['diagram'];
}

type Elements = ReturnType<typeof convertToExcalidrawElements>;

type Drawing =
  { status: 'drawing' } | { status: 'ready'; elements: Elements } | { status: 'failed' };

export function LessonCanvas({ diagram }: LessonCanvasProps) {
  const [drawing, setDrawing] = useState<Drawing>({ status: 'drawing' });

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
          initialData={{ elements: drawing.elements, scrollToContent: true }}
          viewModeEnabled
          theme={loadPrefs().theme}
        />
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
