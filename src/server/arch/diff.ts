import type { ArchModel } from '../../shared/arch-model.ts';

export interface ModelDiff {
  /** False on the first scan, when there is nothing to compare with. */
  hasBaseline: boolean;
  addedNodes: string[];
  removedNodes: string[];
  addedEdges: string[];
  removedEdges: string[];
}

const edgeKey = (from: string, to: string): string => `${from} → ${to}`;

/** What changed between two scans: components and dependencies added or removed. */
export function diffModels(previous: ArchModel | null, next: ArchModel): ModelDiff {
  if (!previous) {
    return {
      hasBaseline: false,
      addedNodes: [],
      removedNodes: [],
      addedEdges: [],
      removedEdges: [],
    };
  }
  const oldNodes = new Set(previous.nodes.map((n) => n.id));
  const newNodes = new Set(next.nodes.map((n) => n.id));
  const oldEdges = new Set(previous.edges.map((e) => edgeKey(e.from, e.to)));
  const newEdges = new Set(next.edges.map((e) => edgeKey(e.from, e.to)));
  return {
    hasBaseline: true,
    addedNodes: [...newNodes].filter((id) => !oldNodes.has(id)).sort(),
    removedNodes: [...oldNodes].filter((id) => !newNodes.has(id)).sort(),
    addedEdges: [...newEdges].filter((key) => !oldEdges.has(key)).sort(),
    removedEdges: [...oldEdges].filter((key) => !newEdges.has(key)).sort(),
  };
}
