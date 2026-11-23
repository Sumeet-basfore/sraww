import { randomUUID } from 'node:crypto';
import { mkdir, readdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { Exclusion, Intake } from './intake.ts';
import { intakeError } from './intake.ts';

export interface ProjectManifest {
  id: string;
  name: string;
  createdAt: string;
  /** When the user accepted the privacy notice for this project. */
  consentAt: string;
  fileCount: number;
  bytes: number;
  excluded: Exclusion[];
}

const ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const MANIFEST = 'manifest.json';
const FILES = 'files';

/**
 * Keeps uploaded projects under one folder, one sub-folder per project. Ids are random and checked
 * against a strict pattern, and every file is written only inside its project's folder.
 */
export function createProjectStore(dir: string) {
  const root = path.resolve(dir);

  function folderOf(id: string): string {
    if (!ID_PATTERN.test(id)) throw intakeError('No such project.', 404);
    return path.join(root, id);
  }

  function filesOf(id: string): string {
    return path.join(folderOf(id), FILES);
  }

  async function readManifest(id: string): Promise<ProjectManifest | null> {
    try {
      return JSON.parse(
        await readFile(path.join(folderOf(id), MANIFEST), 'utf8'),
      ) as ProjectManifest;
    } catch {
      return null;
    }
  }

  return {
    /** Where a project's files are. Used by the architecture scan. */
    filesDir: filesOf,

    async create(input: {
      name: string;
      consentAt: string;
      intake: Intake;
    }): Promise<ProjectManifest> {
      const id = randomUUID();
      const project = folderOf(id);
      const filesRoot = filesOf(id);
      try {
        for (const file of input.intake.files) {
          const target = path.resolve(filesRoot, ...file.path.split('/'));
          if (!target.startsWith(filesRoot + path.sep)) {
            throw intakeError('An upload path points outside its project.', 400);
          }
          await mkdir(path.dirname(target), { recursive: true });
          await writeFile(target, file.data);
        }
        const manifest: ProjectManifest = {
          id,
          name: input.name,
          createdAt: new Date().toISOString(),
          consentAt: input.consentAt,
          fileCount: input.intake.files.length,
          bytes: input.intake.bytes,
          excluded: input.intake.excluded,
        };
        // The manifest is written last, so a half-written project never appears in the list.
        const tmp = path.join(project, `${MANIFEST}.${randomUUID()}.tmp`);
        await writeFile(tmp, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
        await rename(tmp, path.join(project, MANIFEST));
        return manifest;
      } catch (err) {
        await rm(project, { recursive: true, force: true });
        throw err;
      }
    },

    async list(): Promise<ProjectManifest[]> {
      let entries: string[];
      try {
        entries = await readdir(root);
      } catch (err) {
        if ((err as NodeJS.ErrnoException).code === 'ENOENT') return [];
        throw err;
      }
      const manifests = await Promise.all(
        entries.filter((entry) => ID_PATTERN.test(entry)).map((entry) => readManifest(entry)),
      );
      return manifests
        .filter((manifest): manifest is ProjectManifest => manifest !== null)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    },

    async get(id: string): Promise<ProjectManifest> {
      const manifest = await readManifest(id);
      if (!manifest) throw intakeError('No such project.', 404);
      return manifest;
    },

    async remove(id: string): Promise<void> {
      const folder = folderOf(id);
      const manifest = await readManifest(id);
      if (!manifest) throw intakeError('No such project.', 404);
      await rm(folder, { recursive: true, force: true });
    },
  };
}

export type ProjectStore = ReturnType<typeof createProjectStore>;
