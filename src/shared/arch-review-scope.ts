import type { ArchModel } from './arch-model.ts';

export interface ReviewScope {
  folders: number;
  files: number;
  importLinks: number;
  findings: number;
}

/**
 * What an AI review sends, counted the same way buildReviewPrompt selects it: folder (component)
 * nodes, their file counts, and every link leaving a folder. Packages are not counted as folders.
 */
export function reviewScope(model: ArchModel, findingCount: number): ReviewScope {
  const folders = model.nodes.filter((node) => node.kind === 'component');
  const folderIds = new Set(folders.map((node) => node.id));
  return {
    folders: folders.length,
    files: folders.reduce((sum, node) => sum + node.files, 0),
    importLinks: model.edges.filter((edge) => folderIds.has(edge.from)).length,
    findings: findingCount,
  };
}
