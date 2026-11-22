import type { ExcalidrawElementSkeleton } from '@excalidraw/excalidraw/data/transform';
import type { DiagramGraph, GraphNode } from '../../shared/ai-schemas.ts';
import type { Box } from './layout.ts';

const SHAPE_TYPE: Record<NonNullable<GraphNode['shape']>, 'rectangle' | 'ellipse' | 'diamond'> = {
  rectangle: 'rectangle',
  ellipse: 'ellipse',
  diamond: 'diamond',
};

/**
 * Turns a laid-out graph into Excalidraw skeletons. Shapes carry their labels; arrows are bound
 * to shapes by id, so they follow when the user moves a box.
 */
export function graphToSkeleton(
  graph: DiagramGraph,
  boxes: ReadonlyMap<string, Box>,
): ExcalidrawElementSkeleton[] {
  const shapes = graph.nodes.flatMap((node): ExcalidrawElementSkeleton[] => {
    const box = boxes.get(node.id);
    if (!box) return [];
    return [
      {
        type: SHAPE_TYPE[node.shape ?? 'rectangle'],
        id: node.id,
        x: box.x,
        y: box.y,
        width: box.width,
        height: box.height,
        label: { text: node.label, fontSize: 18 },
      },
    ];
  });

  const arrows = graph.edges.map((edge): ExcalidrawElementSkeleton => ({
    type: 'arrow',
    x: 0,
    y: 0,
    start: { id: edge.from },
    end: { id: edge.to },
    ...(edge.label ? { label: { text: edge.label, fontSize: 14 } } : {}),
  }));

  return [...shapes, ...arrows];
}
