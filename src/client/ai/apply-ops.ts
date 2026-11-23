import { convertToExcalidrawElements, newElementWith } from '@excalidraw/excalidraw';
import type { ChatOp } from '../../shared/chat-schemas.ts';
import type { GraphEdge, GraphNode } from '../../shared/ai-schemas.ts';
import {
  arrowStyle,
  borderPoint,
  centreOf,
  edgeLabelSkeleton,
  INK,
  isNote,
  PALETTE,
  shapeStyle,
} from './style.ts';
import { sizeLabel } from './label-sizing.ts';

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

type NodeUpdate = Extract<ChatOp, { type: 'updateNodes' }>['updates'][number];

const LAYER_GAP = 120;
const TEXT_PADDING = 16;

interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
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

const MIN_LABEL_WIDTH = 40;

/** Property changes that put a new label inside its shape: centred, and never wider than the shape. */
function labelChanges(
  text: EditableElement,
  label: string,
  container: EditableElement | undefined,
): Record<string, unknown> {
  const shape =
    container?.type === 'diamond' || container?.type === 'ellipse' ? container.type : 'rectangle';
  const measuredWidth = sizeLabel(label, shape).width - TEXT_PADDING;
  const room = container ? container.width - TEXT_PADDING : Number.POSITIVE_INFINITY;
  const width = Math.max(MIN_LABEL_WIDTH, Math.min(room, measuredWidth));
  const x = container ? container.x + (container.width - width) / 2 : text.x;
  return { text: label, originalText: label, width, x };
}

/**
 * Changes the text or colour of existing shapes and notes. A shape takes the colour as its border
 * and fill; a note\'s text takes it as its colour. A label change goes into the text bound to the
 * shape, or into a note\'s own text. Both kinds of change are applied together.
 */
function applyUpdates(
  elements: EditableElement[],
  updates: readonly NodeUpdate[],
): EditableElement[] {
  const byId = new Map(updates.map((update) => [update.id, update]));
  const byElement = new Map(elements.map((el) => [el.id, el]));
  return elements.map((el) => {
    if (el.isDeleted) return el;
    const own = byId.get(el.id);
    const colour = own?.color ? PALETTE[own.color] : undefined;
    const isNote = el.type === 'text' && !el.containerId;
    const owner = el.containerId ? byId.get(el.containerId) : undefined;
    const changes: Record<string, unknown> = {};
    if (colour && el.type !== 'text') {
      changes.strokeColor = colour.stroke;
      changes.backgroundColor = colour.fill;
    } else if (colour && isNote) {
      changes.strokeColor = colour.stroke;
    } else if (owner?.color && el.type === 'text') {
      changes.strokeColor = PALETTE[owner.color].text;
    }
    if (isNote && own?.label) {
      Object.assign(changes, labelChanges(el, own.label, undefined));
    } else if (el.type === 'text' && owner?.label) {
      const container = el.containerId ? byElement.get(el.containerId) : undefined;
      Object.assign(changes, labelChanges(el, owner.label, container));
    }
    if (Object.keys(changes).length === 0) return el;
    return newElementWith(el as never, changes as never) as unknown as EditableElement;
  });
}

/**
 * Returns a new element list with the edits applied. New shapes go in a row below the drawing.
 * Arrows between two new shapes are glued to them. Arrows that touch an existing shape or a note
 * are drawn between the centres but are not glued, since Excalidraw only binds within one batch
 * and notes are text, not shapes.
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
  const updates: NodeUpdate[] = [];
  const newNodes: GraphNode[] = [];
  const newEdges: GraphEdge[] = [];
  for (const op of ops) {
    if (op.type === 'deleteElements') op.ids.forEach((id) => deletions.add(id));
    if (op.type === 'updateNodes') updates.push(...op.updates);
    if (op.type === 'addNodes') newNodes.push(...op.nodes);
    if (op.type === 'addEdges') newEdges.push(...op.edges);
  }
  if (deletions.size > 0) current = deleteIds(current, deletions);
  if (updates.length > 0) current = applyUpdates(current, updates);

  const liveBottom = Math.max(0, ...[...boxes.values()].map((b) => b.y + b.height));
  const liveLeft = Math.min(0, ...[...boxes.values()].map((b) => b.x));
  const rowY = boxes.size > 0 ? liveBottom + LAYER_GAP : 100;
  let nextX = boxes.size > 0 ? liveLeft : 100;
  newNodes.forEach((node) => {
    const size = sizeLabel(node.label, node.shape);
    boxes.set(node.id, {
      x: nextX,
      y: rowY,
      width: size.width,
      height: size.height,
    });
    nextX += size.width + 60;
  });

  const newIds = new Set(newNodes.map((n) => n.id));
  const noteIds = new Set(newNodes.filter(isNote).map((n) => n.id));
  const bindable = (id: string): boolean => newIds.has(id) && !noteIds.has(id);

  const shapeSkeletons = newNodes
    .filter((node) => !isNote(node))
    .map((node) => {
      const box = boxes.get(node.id) ?? {
        x: 0,
        y: 0,
        width: sizeLabel(node.label, node.shape).width,
        height: sizeLabel(node.label, node.shape).height,
      };
      return {
        ...shapeStyle(node),
        id: node.id,
        x: box.x,
        y: box.y,
        width: box.width,
        height: box.height,
        label: {
          text: node.label,
          fontSize: 18,
          strokeColor: PALETTE[node.color ?? 'neutral'].text,
        },
      };
    });
  const noteTexts = newNodes.filter(isNote).map((node) => {
    const box = boxes.get(node.id) ?? {
      x: 0,
      y: 0,
      width: sizeLabel(node.label, node.shape).width,
      height: sizeLabel(node.label, node.shape).height,
    };
    return {
      type: 'text' as const,
      x: box.x,
      y: box.y,
      text: node.label,
      fontSize: 18,
      strokeColor: node.color ? PALETTE[node.color].text : INK,
    };
  });
  const boundArrows = newEdges
    .filter((edge) => bindable(edge.from) && bindable(edge.to))
    .map((edge) => {
      const from = boxes.get(edge.from)!;
      const to = boxes.get(edge.to)!;
      const a = borderPoint(from, centreOf(to));
      const b = borderPoint(to, centreOf(from));
      return {
        type: 'arrow' as const,
        x: a.x,
        y: a.y,
        points: [
          [0, 0],
          [b.x - a.x, b.y - a.y],
        ],
        start: { id: edge.from },
        end: { id: edge.to },
        ...arrowStyle(edge),
      };
    });
  const boundLabels = newEdges
    .filter((edge) => edge.label && bindable(edge.from) && bindable(edge.to))
    .map((edge) => edgeLabelSkeleton(edge.label ?? '', boxes.get(edge.from)!, boxes.get(edge.to)!));
  const created =
    shapeSkeletons.length + noteTexts.length + boundArrows.length > 0
      ? convertToExcalidrawElements(
          [...shapeSkeletons, ...noteTexts, ...boundArrows, ...boundLabels] as never,
          { regenerateIds: true },
        )
      : [];

  const looseArrows = newEdges
    .filter((edge) => !(bindable(edge.from) && bindable(edge.to)))
    .flatMap((edge) => {
      const from = boxes.get(edge.from);
      const to = boxes.get(edge.to);
      if (!from || !to) return [];
      const a = borderPoint(from, centreOf(to));
      const b = borderPoint(to, centreOf(from));
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
            ...arrowStyle(edge),
          },
          ...(edge.label ? [edgeLabelSkeleton(edge.label, from, to)] : []),
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
