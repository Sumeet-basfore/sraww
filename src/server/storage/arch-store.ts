import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { diagramNameSchema } from '../../shared/diagram.ts';
import {
  archLayoutSchema,
  archModelSchema,
  type ArchLayout,
  type ArchModel,
} from '../../shared/arch-model.ts';
import { reviewSidecarSchema, type ReviewSidecar } from '../arch/review.ts';
import { DiagramError } from './diagram-store.ts';

function isMissing(err: unknown): boolean {
  return typeof err === 'object' && err !== null && 'code' in err && err.code === 'ENOENT';
}

/**
 * Stores architecture models and layouts next to the diagrams, as <name>.arch.json and
 * <name>.arch-layout.json. Names are validated the same way as diagram names.
 */
export function createArchStore(dir: string) {
  const root = path.resolve(dir);

  function fileFor(name: string, suffix: string): string {
    const parsed = diagramNameSchema.safeParse(name);
    if (!parsed.success) {
      throw new DiagramError('INVALID_NAME', parsed.error.issues[0]?.message ?? 'Invalid name');
    }
    return path.join(root, `${name}${suffix}`);
  }

  async function writeJson(file: string, value: unknown): Promise<void> {
    await mkdir(root, { recursive: true });
    const tmp = `${file}.${randomUUID()}.tmp`;
    try {
      await writeFile(tmp, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
      await rename(tmp, file);
    } catch (err) {
      await rm(tmp, { force: true });
      throw err;
    }
  }

  async function readJson(file: string, label: string): Promise<unknown | null> {
    let text: string;
    try {
      text = await readFile(file, 'utf8');
    } catch (err) {
      if (isMissing(err)) return null;
      throw err;
    }
    try {
      return JSON.parse(text);
    } catch {
      throw new DiagramError('INVALID_CONTENT', `The saved ${label} is not valid JSON.`);
    }
  }

  async function readModel(name: string): Promise<ArchModel | null> {
    const raw = await readJson(fileFor(name, '.arch.json'), 'architecture model');
    if (raw === null) return null;
    const parsed = archModelSchema.safeParse(raw);
    if (!parsed.success) {
      throw new DiagramError('INVALID_CONTENT', 'The saved architecture model is not valid.');
    }
    return parsed.data;
  }

  async function writeModel(name: string, model: unknown): Promise<ArchModel> {
    const parsed = archModelSchema.safeParse(model);
    if (!parsed.success) {
      throw new DiagramError('INVALID_CONTENT', 'Not a valid architecture model.');
    }
    await writeJson(fileFor(name, '.arch.json'), parsed.data);
    return parsed.data;
  }

  async function readLayout(name: string): Promise<ArchLayout | null> {
    const raw = await readJson(fileFor(name, '.arch-layout.json'), 'layout');
    if (raw === null) return null;
    const parsed = archLayoutSchema.safeParse(raw);
    return parsed.success ? parsed.data : null;
  }

  async function writeLayout(name: string, layout: unknown): Promise<void> {
    const parsed = archLayoutSchema.safeParse(layout);
    if (!parsed.success) {
      throw new DiagramError('INVALID_CONTENT', 'Not a valid layout.');
    }
    await writeJson(fileFor(name, '.arch-layout.json'), parsed.data);
  }

  async function readReview(name: string): Promise<ReviewSidecar | null> {
    const raw = await readJson(fileFor(name, '.arch-review.json'), 'architecture review');
    if (raw === null) return null;
    const parsed = reviewSidecarSchema.safeParse(raw);
    if (!parsed.success) {
      throw new DiagramError('INVALID_CONTENT', 'The saved architecture review is not valid.');
    }
    return parsed.data;
  }

  async function writeReview(name: string, review: unknown): Promise<ReviewSidecar> {
    const parsed = reviewSidecarSchema.safeParse(review);
    if (!parsed.success) {
      throw new DiagramError('INVALID_CONTENT', 'Not a valid architecture review.');
    }
    await writeJson(fileFor(name, '.arch-review.json'), parsed.data);
    return parsed.data;
  }

  async function removeLayout(name: string): Promise<void> {
    await rm(fileFor(name, '.arch-layout.json'), { force: true });
  }

  return { readModel, writeModel, readLayout, writeLayout, removeLayout, readReview, writeReview };
}

export type ArchStore = ReturnType<typeof createArchStore>;
