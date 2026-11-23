import type { ExcalidrawElementSkeleton } from '@excalidraw/excalidraw/data/transform';
import type { DiagramGraph } from '../../shared/ai-schemas.ts';
import type { Box, Layout } from './layout.ts';
import {
  arrowStyle,
  borderPoint,
  centreOf,
  edgeLabelSkeleton,
  FRAME_STROKE,
  INK,
  isNote,
  PALETTE,
  shapeStyle,
} from './style.ts';

const TITLE_FONT_SIZE = 24;
const TITLE_GAP = 56;

/** The top-left corner of everything drawn, so a title can sit above it. */
function topLeft(boxes: Iterable<Box>): { x: number; y: number } {
  let x = Number.POSITIVE_INFINITY;
  let y = Number.POSITIVE_INFINITY;
  for (const box of boxes) {
    x = Math.min(x, box.x);
    y = Math.min(y, box.y);
  }
  return { x: Number.isFinite(x) ? x : 0, y: Number.isFinite(y) ? y : 0 };
}

/**
 * Turns a laid-out graph into Excalidraw skeletons: group frames first (so they sit behind their
 * shapes), then the shapes with their labels, then the arrows. Arrows are bound to shapes by id, so
 * they follow when the user moves a box.
 */
export function graphToSkeleton(graph: DiagramGraph, layout: Layout): ExcalidrawElementSkeleton[] {
  const frames = [...layout.frames].flatMap(([name, box]): ExcalidrawElementSkeleton[] => [
    {
      type: 'rectangle',
      x: box.x,
      y: box.y,
      width: box.width,
      height: box.height,
      strokeStyle: 'dashed',
      strokeColor: FRAME_STROKE,
      backgroundColor: 'transparent',
    } as ExcalidrawElementSkeleton,
    {
      type: 'text',
      x: box.x + 16,
      y: box.y + 14,
      text: name,
      fontSize: 16,
      strokeColor: FRAME_STROKE,
    } as ExcalidrawElementSkeleton,
  ]);

  const shapes = graph.nodes.flatMap((node): ExcalidrawElementSkeleton[] => {
    const box = layout.boxes.get(node.id);
    if (!box) return [];
    if (isNote(node)) {
      // A note is text alone. Text takes its colour from a shape's border, so it cannot sit in a borderless shape.
      return [
        {
          type: 'text',
          id: node.id,
          x: box.x,
          y: box.y,
          text: node.label,
          fontSize: 18,
          strokeColor: node.color ? PALETTE[node.color].text : INK,
        } as ExcalidrawElementSkeleton,
      ];
    }
    const style = shapeStyle(node);
    return [
      {
        ...style,
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
      } as ExcalidrawElementSkeleton,
    ];
  });

  const noteIds = new Set(graph.nodes.filter(isNote).map((node) => node.id));
  const arrows = graph.edges.flatMap((edge): ExcalidrawElementSkeleton[] => {
    const from = layout.boxes.get(edge.from);
    const to = layout.boxes.get(edge.to);
    if (!from || !to) return [];
    if (noteIds.has(edge.from) || noteIds.has(edge.to)) {
      // Notes cannot take a bound arrow, so the line runs between the two centres, unglued.
      const a = borderPoint(from, centreOf(to));
      const b = borderPoint(to, centreOf(from));
      return [
        {
          type: 'arrow',
          x: a.x,
          y: a.y,
          points: [
            [0, 0],
            [b.x - a.x, b.y - a.y],
          ],
          ...arrowStyle(edge),
        } as ExcalidrawElementSkeleton,
      ];
    }
    if (!from || !to) return [];
    const a = borderPoint(from, centreOf(to));
    const b = borderPoint(to, centreOf(from));
    return [
      {
        type: 'arrow',
        x: a.x,
        y: a.y,
        points: [
          [0, 0],
          [b.x - a.x, b.y - a.y],
        ],
        start: { id: edge.from },
        end: { id: edge.to },
        ...arrowStyle(edge),
      } as ExcalidrawElementSkeleton,
    ];
  });
  const labels = graph.edges.flatMap((edge): ExcalidrawElementSkeleton[] => {
    const from = layout.boxes.get(edge.from);
    const to = layout.boxes.get(edge.to);
    if (!edge.label || !from || !to) return [];
    return [edgeLabelSkeleton(edge.label, from, to) as ExcalidrawElementSkeleton];
  });

  const title = graph.title
    ? [
        (() => {
          const origin = topLeft([...layout.boxes.values(), ...layout.frames.values()]);
          return {
            type: 'text',
            x: origin.x,
            y: origin.y - TITLE_GAP,
            text: graph.title,
            fontSize: TITLE_FONT_SIZE,
          } as ExcalidrawElementSkeleton;
        })(),
      ]
    : [];

  return [...title, ...frames, ...shapes, ...arrows, ...labels];
}
