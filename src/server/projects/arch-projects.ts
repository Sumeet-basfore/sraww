import type { ArchProject } from '../arch/projects.ts';
import type { ProjectStore } from './store.ts';

/** Uploaded projects, as projects the architecture scan can read. */
export async function uploadedArchProjects(store: ProjectStore): Promise<ArchProject[]> {
  return (await store.list()).map((manifest) => {
    return {
      id: `upload-${manifest.id}`,
      label:
        manifest.source?.kind === 'github'
          ? `${manifest.source.repo} (GitHub)`
          : `${manifest.name} (uploaded)`,
      root: store.filesDir(manifest.id),
    };
  });
}
