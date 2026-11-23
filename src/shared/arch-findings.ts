export const FINDING_KINDS = ['cycle', 'orphan', 'hub', 'large-folder', 'deep-nesting'] as const;

export type FindingKind = (typeof FINDING_KINDS)[number];

export interface ArchFinding {
  /** Stable across input ordering because node ids are sorted before joining. */
  id: string;
  kind: FindingKind;
  severity: 'high' | 'medium' | 'low';
  title: string;
  detail: string;
  nodes: string[];
}

export const FINDING_LIMITS = {
  hubDegree: 8,
  largeFolderFiles: 60,
  maxFolderDepth: 6,
} as const;

export function findingId(kind: FindingKind, nodeIds: readonly string[]): string {
  return `${kind}:${[...nodeIds].sort().join(',')}`;
}
