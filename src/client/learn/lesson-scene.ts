import { convertToExcalidrawElements } from '@excalidraw/excalidraw';
import type { DiagramGraph } from '../../shared/ai-schemas.ts';
import type { Layout } from '../ai/layout.ts';
import { graphToSkeleton, originOf } from '../ai/skeleton.ts';
import { type BuildStep, visibleScene } from './build-steps.ts';

export type SceneElements = ReturnType<typeof convertToExcalidrawElements>;

/** The Excalidraw elements for the diagram after its first `shown` build steps. */
export function sceneElements(
  graph: DiagramGraph,
  layout: Layout,
  steps: BuildStep[],
  shown: number,
): SceneElements {
  const visible = visibleScene(graph, layout, steps, shown);
  const skeleton = graphToSkeleton(visible.graph, visible.layout, originOf(layout));
  return convertToExcalidrawElements(skeleton, { regenerateIds: true });
}
