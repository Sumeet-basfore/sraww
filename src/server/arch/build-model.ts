import {
  ARCH_LIMITS,
  type ArchEdge,
  type ArchGroup,
  type ArchModel,
  type ArchNode,
} from '../../shared/arch-model.ts';

export const ROOT_COMPONENT = '.';
const DEFAULT_DEPTH = 2;

/** A dependency found by the scanner: from a project file to another file, or to a package. */
export interface RawEdge {
  from: string;
  to: string;
  kind: 'file' | 'package';
}

export interface BuildInput {
  projectId?: string;
  /** Every scanned file, as a path relative to the project root with forward slashes. */
  files: readonly string[];
  edges: readonly RawEdge[];
  sourceLabel: string;
  generatedAt: string;
  /** How many folder levels make one component. 2 turns src/server/ai/x.ts into "src/server". */
  depth?: number;
}

export class ArchBuildError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ArchBuildError';
  }
}

/** The component (folder) a file belongs to. Files at the root belong to ROOT_COMPONENT. */
export function componentOf(file: string, depth: number = DEFAULT_DEPTH): string {
  const dirs = file.split('/').slice(0, -1);
  if (dirs.length === 0) return ROOT_COMPONENT;
  return dirs.slice(0, depth).join('/');
}

/** The package a bare import refers to: "react", "react-dom/client" and "@scope/pkg/x" all map to their package. */
export function packageOf(specifier: string): string {
  const parts = specifier.split('/');
  if (specifier.startsWith('@') && parts.length >= 2) return `${parts[0]}/${parts[1]}`;
  return parts[0] ?? specifier;
}

function topSegment(component: string): string | null {
  if (component === ROOT_COMPONENT) return null;
  return component.split('/')[0] ?? null;
}

function countBy(keys: readonly string[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const key of keys) counts.set(key, (counts.get(key) ?? 0) + 1);
  return counts;
}

/**
 * Turns raw file dependencies into a component-level model. Each folder becomes a component,
 * each package an external node, and edges between components carry how many file imports they stand for.
 * Components are grouped by their top-level folder.
 */
export function buildArchModel(input: BuildInput): ArchModel {
  const depth = input.depth ?? DEFAULT_DEPTH;
  const fileComponent = new Map<string, string>();
  for (const file of input.files) fileComponent.set(file, componentOf(file, depth));

  const componentIds = [...new Set(fileComponent.values())].sort();
  if (componentIds.length > ARCH_LIMITS.maxComponents) {
    throw new ArchBuildError(
      `This project has ${componentIds.length} folders to draw; the limit is ${ARCH_LIMITS.maxComponents}. Use a shallower depth or scan a smaller folder.`,
    );
  }

  const externalIds = new Set<string>();
  const pairCounts = new Map<string, number>();
  for (const edge of input.edges) {
    const fromComponent = fileComponent.get(edge.from) ?? componentOf(edge.from, depth);
    let toComponent: string;
    if (edge.kind === 'package') {
      toComponent = `ext:${packageOf(edge.to)}`;
      externalIds.add(toComponent);
    } else {
      toComponent = fileComponent.get(edge.to) ?? componentOf(edge.to, depth);
      if (toComponent === fromComponent) continue;
    }
    const key = `${fromComponent}\u0000${toComponent}`;
    pairCounts.set(key, (pairCounts.get(key) ?? 0) + 1);
  }

  const fileCounts = countBy([...fileComponent.values()]);
  const membersOf = new Map<string, string[]>();
  for (const [file, component] of fileComponent) {
    membersOf.set(component, [...(membersOf.get(component) ?? []), file].sort());
  }

  const componentNodes: ArchNode[] = componentIds.map((id) => ({
    id,
    label: id === ROOT_COMPONENT ? '(root)' : id,
    kind: 'component',
    group: topSegment(id),
    files: fileCounts.get(id) ?? 0,
    members: (membersOf.get(id) ?? []).slice(0, ARCH_LIMITS.maxMembers),
  }));
  const externalNodes: ArchNode[] = [...externalIds].sort().map((id) => ({
    id,
    label: id.slice('ext:'.length),
    kind: 'external',
    group: null,
    files: 0,
    members: [],
  }));

  const groupIds = [
    ...new Set(componentNodes.map((n) => n.group).filter((g): g is string => !!g)),
  ].sort();
  const groups: ArchGroup[] = groupIds.map((id) => ({
    id,
    label: id,
    members: componentNodes.filter((n) => n.group === id).map((n) => n.id),
  }));

  const edges: ArchEdge[] = [...pairCounts]
    .map(([key, count]) => {
      const [from = '', to = ''] = key.split('\u0000');
      return { from, to, count };
    })
    .sort((a, b) => b.count - a.count || a.from.localeCompare(b.from) || a.to.localeCompare(b.to))
    .slice(0, ARCH_LIMITS.maxEdges);

  return {
    version: 1,
    ...(input.projectId ? { projectId: input.projectId } : {}),
    sourceLabel: input.sourceLabel,
    generatedAt: input.generatedAt,
    nodes: [...componentNodes, ...externalNodes],
    edges,
    groups,
  };
}
