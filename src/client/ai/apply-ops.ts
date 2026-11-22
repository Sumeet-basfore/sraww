import { convertToExcalidrawElements, newElementWith } from '@excalidraw/excalidraw';
import type { ChatOp } from '../../shared/chat-schemas.ts';
import type { GraphEdge, GraphNode } from '../../shared/ai-schemas.ts';

/** Element fields used here. Excalidraw elements carry many more; they are kept untouched. */
export interface EditableElement {
  id: string;
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
  isDeleted?: boolean;
  containerId?: string | null;
  startBinding?: { elementId: string } | null;
  endBinding?: { elementId: string } | null;
  [key: string]: unknown;
}

const NEW_SHAPE_WIDTH = 160;
const NEW_SHAPE_HEIGHT = 72;
const ROW_GAP = 220;
const LAYER_GAP = 120;

interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

function centerOf(box: Box): { x: number; y: number } {
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

/** Drops a shape, its label, and every arrow glued to it or to a deleted shape. */
function deleteIds(elements: EditableElement[], ids: ReadonlySet<string>): EditableElement[] {
  return elements.map((el) => {
    if (el.isDeleted) return el;
    const gone =
      ids.has(el.id) ||
      (el.containerId != null && ids.has(el.containerId)) ||
      (el.type === 'arrow' &&
        (ids.has(el.startBinding?.elementId ?? '') || ids.has(el.endBinding?.elementId ?? '')));
    return gone
      ? (newElementWith(el as never, { isDeleted: true } as never) as unknown as EditableElement)
      : el;
  });
}

/**
 * Returns a new element list with the edits applied. New shapes go in a row below the drawing.
 * Arrows between two new shapes are glued to them. Arrows that touch an existing shape are
 * drawn between the shapes' centres but are not glued, since Excalidraw only binds within one batch.
 */
export function applyChatOps(
  elements: readonly EditableElement[],
  ops: readonly ChatOp[],
): EditableElement[] {
  let current = [...elements];
  const boxes = new Map<string, Box>();
  for (const el of current) {
    if (!el.isDeleted) boxes.set(el.id, { x: el.x, y: el.y, width: el.width, height: el.height });
  }

  const deletions = new Set<string>();
  const newNodes: GraphNode[] = [];
  const newEdges: GraphEdge[] = [];
  for (const op of ops) {
    if (op.type === 'deleteElements') op.ids.forEach((id) => deletions.add(id));
    if (op.type === 'addNodes') newNodes.push(...op.nodes);
    if (op.type === 'addEdges') newEdges.push(...op.edges);
  }
  if (deletions.size > 0) current = deleteIds(current, deletions);

  const liveBottom = Math.max(0, ...[...boxes.values()].map((b) => b.y + b.height));
  const liveLeft = Math.min(0, ...[...boxes.values()].map((b) => b.x));
  const rowY = boxes.size > 0 ? liveBottom + LAYER_GAP : 0;
  newNodes.forEach((node, index) => {
    boxes.set(node.id, {
      x: liveLeft + index * ROW_GAP,
      y: rowY,
      width: NEW_SHAPE_WIDTH,
      height: NEW_SHAPE_HEIGHT,
    });
  });

  const newIds = new Set(newNodes.map((n) => n.id));
  const shapeSkeletons = newNodes.map((node) => {
    const box = boxes.get(node.id) ?? {
      x: 0,
      y: 0,
      width: NEW_SHAPE_WIDTH,
      height: NEW_SHAPE_HEIGHT,
    };
    return {
      type: node.shape ?? 'rectangle',
      id: node.id,
      x: box.x,
      y: box.y,
      width: box.width,
      height: box.height,
      label: { text: node.label, fontSize: 18 },
    };
  });
  const boundArrows = newEdges
    .filter((edge) => newIds.has(edge.from) && newIds.has(edge.to))
    .map((edge) => ({
      type: 'arrow' as const,
      x: 0,
      y: 0,
      start: { id: edge.from },
      end: { id: edge.to },
      ...(edge.label ? { label: { text: edge.label, fontSize: 14 } } : {}),
    }));
  const created =
    shapeSkeletons.length + boundArrows.length > 0
      ? convertToExcalidrawElements([...shapeSkeletons, ...boundArrows] as never, {
          regenerateIds: true,
        })
      : [];

  const looseArrows = newEdges
    .filter((edge) => !(newIds.has(edge.from) && newIds.has(edge.to)))
    .flatMap((edge) => {
      const from = boxes.get(edge.from);
      const to = boxes.get(edge.to);
      if (!from || !to) return [];
      const a = centerOf(from);
      const b = centerOf(to);
      return convertToExcalidrawElements(
        [
          {
            type: 'arrow',
            x: a.x,
            y: a.y,
            points: [
              [0, 0],
              [b.x - a.x, b.y - a.y],
            ],
            ...(edge.label ? { label: { text: edge.label, fontSize: 14 } } : {}),
          },
        ] as never,
        { regenerateIds: true },
      );
    });

  return [
    ...current,
    ...(created as unknown as EditableElement[]),
    ...(looseArrows as unknown as EditableElement[]),
  ];
}
