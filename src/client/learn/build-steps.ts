import type { DiagramGraph, GraphNode } from '../../shared/ai-schemas.ts';
import type { Layout } from '../ai/layout.ts';

/** What one step of the build-up reveals. Edges and groups are listed by the step that shows them. */
export interface BuildStep {
  nodeIds: string[];
  groups: string[];
  edgeIndexes: number[];
}

export interface PlanOptions {
  nodesPerStep?: number;
}

const DEFAULT_NODES_PER_STEP = 1;

/**
 * Splits a graph into build-up steps. Nodes come in topological order (ties go to the earlier
 * declaration), a group frame appears with the first of its nodes, and an edge appears once both of
 * its ends are shown. A cycle has no start, so its earliest unplaced node goes next.
 */
export function planBuild(graph: DiagramGraph, options: PlanOptions = {}): BuildStep[] {
  const size = Math.max(1, Math.floor(options.nodesPerStep ?? DEFAULT_NODES_PER_STEP));
  const order = nodeOrder(graph);
  const steps: BuildStep[] = [];
  for (let start = 0; start < order.length; start += size) {
    steps.push({ nodeIds: order.slice(start, start + size), groups: [], edgeIndexes: [] });
  }

  const stepOf = new Map<string, number>();
  steps.forEach((step, index) => step.nodeIds.forEach((id) => stepOf.set(id, index)));

  const nodeById = firstNodesById(graph.nodes);
  const shownGroups = new Set<string>();
  steps.forEach((step) => {
    for (const id of step.nodeIds) {
      const group = groupOf(nodeById.get(id));
      if (group && !shownGroups.has(group)) {
        shownGroups.add(group);
        step.groups.push(group);
      }
    }
  });

  graph.edges.forEach((edge, index) => {
    const from = stepOf.get(edge.from);
    const to = stepOf.get(edge.to);
    if (from === undefined || to === undefined) return;
    steps[Math.max(from, to)]?.edgeIndexes.push(index);
  });

  return steps;
}

/** The scene after the first `shown` steps: only what they reveal, with the layout's boxes intact. */
export function visibleScene(
  graph: DiagramGraph,
  layout: Layout,
  steps: BuildStep[],
  shown: number,
): { graph: DiagramGraph; layout: Layout } {
  const revealed = steps.slice(0, shown);
  const nodeIds = new Set(revealed.flatMap((step) => step.nodeIds));
  const groups = new Set(revealed.flatMap((step) => step.groups));
  const edgeIndexes = new Set(revealed.flatMap((step) => step.edgeIndexes));
  return {
    graph: {
      ...graph,
      nodes: graph.nodes.filter((node) => nodeIds.has(node.id)),
      edges: graph.edges.filter((_, index) => edgeIndexes.has(index)),
    },
    layout: {
      boxes: layout.boxes,
      frames: new Map([...layout.frames].filter(([name]) => groups.has(name))),
    },
  };
}

/** Kahn's algorithm, always taking the earliest declared node that is ready. */
function nodeOrder(graph: DiagramGraph): string[] {
  const ids = [...new Set(graph.nodes.map((node) => node.id))];
  const known = new Set(ids);
  const incoming = new Map<string, string[]>(ids.map((id) => [id, []]));
  for (const edge of graph.edges) {
    if (edge.from === edge.to || !known.has(edge.from) || !known.has(edge.to)) continue;
    incoming.get(edge.to)?.push(edge.from);
  }

  const placed = new Set<string>();
  const order: string[] = [];
  while (order.length < ids.length) {
    const ready = ids.find(
      (id) => !placed.has(id) && (incoming.get(id) ?? []).every((from) => placed.has(from)),
    );
    const next = ready ?? ids.find((id) => !placed.has(id));
    if (next === undefined) break;
    placed.add(next);
    order.push(next);
  }
  return order;
}

function firstNodesById(nodes: GraphNode[]): Map<string, GraphNode> {
  const byId = new Map<string, GraphNode>();
  for (const node of nodes) {
    if (!byId.has(node.id)) byId.set(node.id, node);
  }
  return byId;
}

/** Notes are drawn outside every group, so a note never brings a frame in. */
function groupOf(node: GraphNode | undefined): string | undefined {
  if (!node || node.shape === 'note') return undefined;
  return node.group ?? undefined;
}
