import ELK from 'elkjs/lib/elk.bundled.js';
import type { DiagramGraph, GraphNode } from '../../shared/ai-schemas.ts';

export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Where each node and each group frame ends up. Positions are absolute, on the drawing. */
export interface Layout {
  boxes: Map<string, Box>;
  frames: Map<string, Box>;
}

interface ElkBox {
  id: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  children?: ElkBox[];
}

const elk = new ELK();
/** Group containers get ids with this prefix. Node ids cannot contain a colon, so they never clash. */
const GROUP_PREFIX = 'group:';

/** Node size from its label, so text fits inside the shape. */
export function sizeFor(node: GraphNode): { width: number; height: number } {
  const textWidth = node.label.length * 9 + 48;
  const width = Math.min(280, Math.max(140, textWidth));
  if (node.shape === 'ellipse') return { width: width + 20, height: 96 };
  if (node.shape === 'diamond') return { width: width + 60, height: 110 };
  return { width, height: 72 };
}

function boxOf(element: ElkBox): Box {
  return {
    x: element.x ?? 0,
    y: element.y ?? 0,
    width: element.width ?? 0,
    height: element.height ?? 0,
  };
}

/**
 * Lays the graph out with ELK's layered algorithm. Nodes that share a group are placed inside one
 * container, which becomes a dashed frame. The model never provides coordinates.
 */
export async function layoutGraph(graph: DiagramGraph): Promise<Layout> {
  const groups = new Map<string, GraphNode[]>();
  const loose: GraphNode[] = [];
  const notes = graph.nodes.filter((node) => node.shape === 'note');
  for (const node of graph.nodes) {
    if (node.shape === 'note') continue;
    if (node.group) {
      groups.set(node.group, [...(groups.get(node.group) ?? []), node]);
    } else {
      loose.push(node);
    }
  }

  const children: ElkBox[] = [
    ...[...groups.entries()].map(([name, members]) => ({
      id: `${GROUP_PREFIX}${name}`,
      // Room above the members for the frame's name.
      layoutOptions: { 'elk.padding': '[top=48,left=24,bottom=24,right=24]' },
      children: members.map((node) => ({ id: node.id, ...sizeFor(node) })),
    })),
    ...loose.map((node) => ({ id: node.id, ...sizeFor(node) })),
  ] as ElkBox[];

  const result = (await elk.layout({
    id: 'root',
    layoutOptions: {
      'elk.algorithm': 'layered',
      'elk.direction': graph.direction === 'right' ? 'RIGHT' : 'DOWN',
      'elk.hierarchyHandling': 'INCLUDE_CHILDREN',
      'elk.spacing.nodeNode': '50',
      'elk.layered.spacing.nodeNodeBetweenLayers': '80',
    },
    children,
    edges: graph.edges
      .filter((edge) => !noteIds(graph).has(edge.from) && !noteIds(graph).has(edge.to))
      .map((edge, index) => ({
        id: `e${index}`,
        sources: [edge.from],
        targets: [edge.to],
      })),
  })) as unknown as ElkBox;

  const boxes = new Map<string, Box>();
  const frames = new Map<string, Box>();
  for (const child of result.children ?? []) {
    if (!child.id.startsWith(GROUP_PREFIX)) {
      boxes.set(child.id, boxOf(child));
      continue;
    }
    // ELK gives positions relative to the container, so add the container's position.
    const frame = boxOf(child);
    frames.set(child.id.slice(GROUP_PREFIX.length), frame);
    for (const member of child.children ?? []) {
      const local = boxOf(member);
      boxes.set(member.id, {
        ...local,
        x: frame.x + local.x,
        y: frame.y + local.y,
      });
    }
  }
  placeNotes(notes, graph, boxes);
  return { boxes, frames };
}

function noteIds(graph: DiagramGraph): Set<string> {
  return new Set(graph.nodes.filter((node) => node.shape === 'note').map((node) => node.id));
}

/**
 * A note sits just to the right of the first shape it is joined to, so its arrow stays short.
 * A note joined to nothing goes below the diagram.
 */
function placeNotes(notes: GraphNode[], graph: DiagramGraph, boxes: Map<string, Box>): void {
  const bottom = Math.max(0, ...[...boxes.values()].map((box) => box.y + box.height));
  const left = Math.min(0, ...[...boxes.values()].map((box) => box.x));
  notes.forEach((note, index) => {
    const size = sizeFor(note);
    const join = graph.edges.find((edge) => edge.from === note.id || edge.to === note.id);
    const other = join ? (join.from === note.id ? join.to : join.from) : undefined;
    const anchor = other ? boxes.get(other) : undefined;
    if (anchor) {
      boxes.set(note.id, {
        x: anchor.x + anchor.width + 80,
        y: anchor.y + (anchor.height - size.height) / 2 + index * 8,
        ...size,
      });
    } else {
      boxes.set(note.id, { x: left, y: bottom + 120 + index * 100, ...size });
    }
  });
}
