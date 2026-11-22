import {
  GRAPH_LIMITS,
  type DiagramGraph,
  type GraphEdge,
  type GraphNode,
} from '../../shared/ai-schemas.ts';

const CONTROL_CHARS = /\p{Cc}/gu;

function cleanLabel(text: string): string {
  return text
    .replace(CONTROL_CHARS, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, GRAPH_LIMITS.maxLabel);
}

/**
 * Makes a model's graph safe to draw: unique node ids, the node cap applied first, then edges
 * that point only at kept nodes, and labels stripped of control characters.
 * Returns a new object; the input is not changed.
 */
export function normalizeGraph(graph: DiagramGraph): DiagramGraph {
  const nodes: GraphNode[] = [];
  const seen = new Set<string>();
  for (const node of graph.nodes) {
    if (seen.has(node.id) || nodes.length >= GRAPH_LIMITS.maxNodes) continue;
    seen.add(node.id);
    nodes.push({ ...node, label: cleanLabel(node.label) || node.id });
  }

  const edges: GraphEdge[] = graph.edges
    .filter((edge) => seen.has(edge.from) && seen.has(edge.to))
    .slice(0, GRAPH_LIMITS.maxEdges)
    .map((edge) => ({
      from: edge.from,
      to: edge.to,
      ...(edge.label ? { label: cleanLabel(edge.label) } : {}),
    }));

  return { nodes, edges };
}
