import path from 'node:path';

export interface ArchProject {
  id: string;
  label: string;
  root: string;
}

function slug(text: string): string {
  return (
    text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'project'
  );
}

/**
 * The folders the user allowed to be scanned, from ARCH_PROJECTS (comma-separated absolute paths).
 * A scan can only name one of these, so the browser never chooses a path on disk.
 */
export function listArchProjects(value: string): ArchProject[] {
  const roots = value
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
  const used = new Map<string, number>();
  return roots.flatMap((raw) => {
    if (!path.isAbsolute(raw)) return [];
    const root = path.resolve(raw);
    const label = path.basename(root) || root;
    const base = slug(label);
    const count = (used.get(base) ?? 0) + 1;
    used.set(base, count);
    return [{ id: count === 1 ? base : `${base}-${count}`, label, root }];
  });
}
