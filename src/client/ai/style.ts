import type { Color, GraphEdge, GraphNode } from '../../shared/ai-schemas.ts';

/** Light-theme colours: a border and a soft fill. Neutral has no fill. */
export const PALETTE: Record<Color, { stroke: string; fill: string }> = {
  neutral: { stroke: '#1e1e1e', fill: 'transparent' },
  blue: { stroke: '#1971c2', fill: '#d0ebff' },
  green: { stroke: '#2f9e44', fill: '#d3f9d8' },
  amber: { stroke: '#e67700', fill: '#fff3bf' },
  red: { stroke: '#c92a2a', fill: '#ffe3e3' },
  violet: { stroke: '#6741d9', fill: '#e5dbff' },
};

/** Text colour for notes, and for anything drawn as plain text. */
export const INK = '#1e1e1e';

/** The colour of a group frame and its label. Kept neutral so frames sit behind their shapes. */
export const FRAME_STROKE = '#868e96';

export interface ShapeStyle {
  type: 'rectangle' | 'ellipse' | 'diamond';
  strokeColor: string;
  backgroundColor: string;
  roundness: { type: number } | null;
}

/** Excalidraw properties for a node. A note is a borderless rectangle that holds only its label. */
export function shapeStyle(node: Pick<GraphNode, 'shape' | 'color'>): ShapeStyle {
  const palette = PALETTE[node.color ?? 'neutral'];
  switch (node.shape ?? 'rectangle') {
    case 'ellipse':
      return {
        type: 'ellipse',
        strokeColor: palette.stroke,
        backgroundColor: palette.fill,
        roundness: null,
      };
    case 'diamond':
      return {
        type: 'diamond',
        strokeColor: palette.stroke,
        backgroundColor: palette.fill,
        roundness: null,
      };
    case 'rounded':
      return {
        type: 'rectangle',
        strokeColor: palette.stroke,
        backgroundColor: palette.fill,
        roundness: { type: 3 },
      };
    case 'note':
      return {
        type: 'rectangle',
        strokeColor: 'transparent',
        backgroundColor: 'transparent',
        roundness: null,
      };
    default:
      return {
        type: 'rectangle',
        strokeColor: palette.stroke,
        backgroundColor: palette.fill,
        roundness: null,
      };
  }
}

export interface ArrowStyle {
  strokeStyle: 'solid' | 'dashed';
  startArrowhead: 'arrow' | null;
  endArrowhead: 'arrow' | null;
}

/** Line and arrowhead settings for an edge. The default is a solid line with one head at the end. */
export function arrowStyle(edge: Pick<GraphEdge, 'style' | 'arrow'>): ArrowStyle {
  return {
    strokeStyle: edge.style === 'dashed' ? 'dashed' : 'solid',
    startArrowhead: edge.arrow === 'both' ? 'arrow' : null,
    endArrowhead: edge.arrow === 'none' ? null : 'arrow',
  };
}

/**
 * A label for an arrow, as a plain text element at the middle of the line between two shapes.
 * Arrow labels bound to a skeleton are not repositioned by Excalidraw, so they are placed here.
 */
export function edgeLabelSkeleton(
  text: string,
  from: { x: number; y: number; width: number; height: number },
  to: { x: number; y: number; width: number; height: number },
): { type: 'text'; x: number; y: number; text: string; fontSize: number } {
  const midX = (from.x + from.width / 2 + to.x + to.width / 2) / 2;
  const midY = (from.y + from.height / 2 + to.y + to.height / 2) / 2;
  const approxWidth = text.length * 8;
  return { type: 'text', x: midX - approxWidth / 2, y: midY - 26, text, fontSize: 14 };
}

export function isNote(node: Pick<GraphNode, 'shape'>): boolean {
  return node.shape === 'note';
}

/** The centre of a box. */
export function centreOf(box: { x: number; y: number; width: number; height: number }): {
  x: number;
  y: number;
} {
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

/** The point on a box's border where a line from its centre toward `toward` leaves it. */
export function borderPoint(
  box: { x: number; y: number; width: number; height: number },
  toward: { x: number; y: number },
): { x: number; y: number } {
  const centre = centreOf(box);
  const dx = toward.x - centre.x;
  const dy = toward.y - centre.y;
  if (dx === 0 && dy === 0) return centre;
  const halfW = box.width / 2;
  const halfH = box.height / 2;
  const scale = Math.min(
    dx !== 0 ? halfW / Math.abs(dx) : Number.POSITIVE_INFINITY,
    dy !== 0 ? halfH / Math.abs(dy) : Number.POSITIVE_INFINITY,
  );
  return { x: centre.x + dx * scale, y: centre.y + dy * scale };
}
