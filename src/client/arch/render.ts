import type { ExcalidrawElementSkeleton } from '@excalidraw/excalidraw/data/transform';
import type { DiagramGraph } from '../../shared/ai-schemas.ts';
import type { ArchLayout, ArchModel } from '../../shared/arch-model.ts';
import { layoutGraph, type Box } from '../ai/layout.ts';

const GROUP_PADDING = 32;
const GROUP_TITLE_HEIGHT = 40;

/** Stable Excalidraw ids, so the diagram can be matched back to the model later. */
export const elementIds = {
  node: (id: string) => `node:${id}`,
  group: (id: string) => `group:${id}`,
  groupLabel: (id: string) => `grouplabel:${id}`,
  edge: (from: string, to: string) => `edge:${from}>${to}`,
};

/** The model as a plain graph, so the same ELK layout as the AI diagrams can place it. */
export function archToGraph(model: ArchModel): DiagramGraph {
  return {
    nodes: model.nodes.map((node) => ({
      id: node.id,
      label: node.label,
      shape: node.kind === 'external' ? 'ellipse' : 'rectangle',
    })),
    edges: model.edges.map((edge) => ({
      from: edge.from,
      to: edge.to,
      label: edge.count > 1 ? String(edge.count) : undefined,
    })),
  };
}

/** Saved positions win; nodes without one keep the computed place. Positions for removed nodes are ignored. */
export function mergeBoxes(
  computed: ReadonlyMap<string, Box>,
  saved: ArchLayout['positions'] | null | undefined,
): Map<string, Box> {
  const merged = new Map<string, Box>();
  for (const [id, box] of computed) {
    const position = saved?.[id];
    merged.set(id, position ? { ...box, x: position.x, y: position.y } : box);
  }
  return merged;
}

export interface GroupFrame {
  id: string;
  label: string;
  box: Box;
}

/** One frame per group, drawn around its member components, with the title above. */
export function groupFrames(model: ArchModel, boxes: ReadonlyMap<string, Box>): GroupFrame[] {
  const frames: GroupFrame[] = [];
  for (const group of model.groups) {
    const members = group.members.map((id) => boxes.get(id)).filter((b): b is Box => !!b);
    if (members.length === 0) continue;
    const left = Math.min(...members.map((b) => b.x)) - GROUP_PADDING;
    const top = Math.min(...members.map((b) => b.y)) - GROUP_PADDING - GROUP_TITLE_HEIGHT;
    const right = Math.max(...members.map((b) => b.x + b.width)) + GROUP_PADDING;
    const bottom = Math.max(...members.map((b) => b.y + b.height)) + GROUP_PADDING;
    frames.push({
      id: group.id,
      label: group.label,
      box: { x: left, y: top, width: right - left, height: bottom - top },
    });
  }
  return frames;
}

/** The point where the line from a box centre towards `toward` leaves the box. */
export function anchorOn(box: Box, toward: { x: number; y: number }): { x: number; y: number } {
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  const dx = toward.x - cx;
  const dy = toward.y - cy;
  if (dx === 0 && dy === 0) return { x: cx, y: cy };
  const halfW = box.width / 2;
  const halfH = box.height / 2;
  const t = Math.min(
    dx === 0 ? Infinity : halfW / Math.abs(dx),
    dy === 0 ? Infinity : halfH / Math.abs(dy),
  );
  return { x: cx + dx * t, y: cy + dy * t };
}

function arrowWidth(count: number): number {
  return Math.min(4, 1 + Math.log2(Math.max(1, count)));
}

/**
 * Excalidraw skeletons for the architecture: group frames behind, then components, then arrows.
 * Arrows are glued to components by id, so they follow when a box is dragged.
 */
export function archSkeleton(
  model: ArchModel,
  boxes: ReadonlyMap<string, Box>,
): ExcalidrawElementSkeleton[] {
  const frames = groupFrames(model, boxes).flatMap((frame): ExcalidrawElementSkeleton[] => [
    {
      type: 'rectangle',
      id: elementIds.group(frame.id),
      x: frame.box.x,
      y: frame.box.y,
      width: frame.box.width,
      height: frame.box.height,
      backgroundColor: '#f5f3ff',
      strokeColor: '#a5a0e0',
      strokeStyle: 'dashed',
      roughness: 0,
    },
    {
      type: 'text',
      id: elementIds.groupLabel(frame.id),
      x: frame.box.x + 14,
      y: frame.box.y + 10,
      text: frame.label,
      fontSize: 16,
    },
  ]);

  const nodes = model.nodes.flatMap((node): ExcalidrawElementSkeleton[] => {
    const box = boxes.get(node.id);
    if (!box) return [];
    const external = node.kind === 'external';
    return [
      {
        type: external ? 'ellipse' : 'rectangle',
        id: elementIds.node(node.id),
        x: box.x,
        y: box.y,
        width: box.width,
        height: box.height,
        backgroundColor: external ? '#fff7ed' : '#ffffff',
        strokeColor: external ? '#c2410c' : '#4f46e5',
        roughness: 0,
        label: { text: node.label, fontSize: 16 },
      },
    ];
  });

  const arrows = model.edges
    .filter((edge) => boxes.has(edge.from) && boxes.has(edge.to))
    .map((edge): ExcalidrawElementSkeleton => {
      const fromBox = boxes.get(edge.from) as Box;
      const toBox = boxes.get(edge.to) as Box;
      const toCenter = { x: toBox.x + toBox.width / 2, y: toBox.y + toBox.height / 2 };
      const fromCenter = { x: fromBox.x + fromBox.width / 2, y: fromBox.y + fromBox.height / 2 };
      const a = anchorOn(fromBox, toCenter);
      const b = anchorOn(toBox, fromCenter);
      return {
        type: 'arrow',
        id: elementIds.edge(edge.from, edge.to),
        x: a.x,
        y: a.y,
        points: [
          [0, 0],
          [b.x - a.x, b.y - a.y],
        ],
        start: { id: elementIds.node(edge.from) },
        end: { id: elementIds.node(edge.to) },
        strokeWidth: arrowWidth(edge.count),
        strokeColor: '#6b7280',
        roughness: 0,
        ...(edge.count > 1 ? { label: { text: String(edge.count), fontSize: 12 } } : {}),
      };
    });

  return [...frames, ...nodes, ...arrows];
}

/** Lays the model out (ELK), applies any saved positions, and returns skeletons ready for Excalidraw. */
export async function renderArchitecture(
  model: ArchModel,
  savedLayout: ArchLayout | null,
): Promise<{ skeleton: ExcalidrawElementSkeleton[]; boxes: Map<string, Box> }> {
  const computed = await layoutGraph(archToGraph(model));
  const boxes = mergeBoxes(computed, savedLayout?.positions);
  return { skeleton: archSkeleton(model, boxes), boxes };
}
