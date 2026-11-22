import ELK from 'elkjs/lib/elk.bundled.js';
import type { DiagramGraph, GraphNode } from '../../shared/ai-schemas.ts';

export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

const elk = new ELK();

/** Node size from its label, so text fits inside the shape. */
export function sizeFor(node: GraphNode): { width: number; height: number } {
  const textWidth = node.label.length * 9 + 48;
  const width = Math.min(280, Math.max(140, textWidth));
  if (node.shape === 'ellipse') return { width: width + 20, height: 96 };
  if (node.shape === 'diamond') return { width: width + 60, height: 110 };
  return { width, height: 72 };
}

/**
 * Lays the graph out top to bottom with ELK's layered algorithm. Returns a box per node id.
 * The model never provides coordinates, so overlaps and tangled arrows come from layout, not guesses.
 */
export async function layoutGraph(graph: DiagramGraph): Promise<Map<string, Box>> {
  const result = await elk.layout({
    id: 'root',
    layoutOptions: {
      'elk.algorithm': 'layered',
      'elk.direction': 'DOWN',
      'elk.spacing.nodeNode': '50',
      'elk.layered.spacing.nodeNodeBetweenLayers': '80',
    },
    children: graph.nodes.map((node) => ({ id: node.id, ...sizeFor(node) })),
    edges: graph.edges.map((edge, index) => ({
      id: `e${index}`,
      sources: [edge.from],
      targets: [edge.to],
    })),
  });

  const boxes = new Map<string, Box>();
  for (const child of result.children ?? []) {
    boxes.set(child.id, {
      x: child.x ?? 0,
      y: child.y ?? 0,
      width: child.width ?? 0,
      height: child.height ?? 0,
    });
  }
  return boxes;
}
