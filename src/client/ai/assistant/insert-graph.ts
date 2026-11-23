import { CaptureUpdateAction, convertToExcalidrawElements } from '@excalidraw/excalidraw';
import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types';
import type { DiagramGraph } from '../../../shared/ai-schemas.ts';
import { layoutGraph } from '../layout.ts';
import { graphToSkeleton } from '../skeleton.ts';

/**
 * Draws a generated diagram on the canvas. "add" keeps what is there; "replace" clears it first.
 * The caller confirms a replace before calling this.
 */
export async function insertGraph(
  api: ExcalidrawImperativeAPI,
  graph: DiagramGraph,
  mode: 'add' | 'replace',
): Promise<void> {
  const layout = await layoutGraph(graph);
  const created = convertToExcalidrawElements(graphToSkeleton(graph, layout), {
    regenerateIds: true,
  });
  const existing = mode === 'add' ? api.getSceneElementsIncludingDeleted() : [];
  api.updateScene({
    elements: [...existing, ...created],
    captureUpdate: CaptureUpdateAction.IMMEDIATELY,
  });
  api.scrollToContent(created, { fitToContent: true });
}
