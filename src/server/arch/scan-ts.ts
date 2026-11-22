import { cruise } from 'dependency-cruiser';
import { ScanError } from './collect-files.ts';
import type { RawEdge } from './build-model.ts';

interface CruisedDependency {
  module: string;
  resolved: string;
  coreModule: boolean;
  dependencyTypes: string[];
  couldNotResolve: boolean;
}

interface CruisedModule {
  source: string;
  dependencies: CruisedDependency[];
}

/** Dependencies that point at a package rather than a file of the project. */
function isPackageDependency(dep: CruisedDependency): boolean {
  if (dep.coreModule) return true;
  if (dep.module.startsWith('.') || dep.module.startsWith('/')) return false;
  return (
    dep.dependencyTypes.some((type) => type.startsWith('npm')) ||
    dep.resolved.includes('node_modules/')
  );
}

/** Turns dependency-cruiser's module list into file and package edges between the given files. */
export function toRawEdges(
  modules: readonly CruisedModule[],
  files: ReadonlySet<string>,
): RawEdge[] {
  const edges: RawEdge[] = [];
  for (const mod of modules) {
    if (!files.has(mod.source)) continue;
    for (const dep of mod.dependencies) {
      if (isPackageDependency(dep)) {
        edges.push({ from: mod.source, to: dep.module, kind: 'package' });
      } else if (!dep.couldNotResolve && files.has(dep.resolved)) {
        edges.push({ from: mod.source, to: dep.resolved, kind: 'file' });
      }
    }
  }
  return edges;
}

function withTimeout<T>(work: Promise<T>, timeoutMs: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const limit = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new ScanError('TIMEOUT', 'The scan took too long. Try a smaller folder.')),
      timeoutMs,
    );
  });
  return Promise.race([work, limit]).finally(() => clearTimeout(timer));
}

/**
 * Reads the import graph of the given files with dependency-cruiser. It only reads files and never
 * follows into node_modules. Packages are reported by name, project files by path.
 */
export async function scanImports(
  root: string,
  files: readonly string[],
  timeoutMs: number,
): Promise<RawEdge[]> {
  const result = await withTimeout(
    cruise([...files], {
      baseDir: root,
      outputType: 'json',
      doNotFollow: { path: 'node_modules' },
    }),
    timeoutMs,
  ).catch((err: unknown) => {
    if (err instanceof ScanError) throw err;
    throw new ScanError('FAILED', 'Could not read the imports of this project.');
  });
  const raw: unknown = result.output;
  const parsed = (typeof raw === 'string' ? JSON.parse(raw) : raw) as { modules: CruisedModule[] };
  return toRawEdges(parsed.modules, new Set(files));
}
