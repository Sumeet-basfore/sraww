import { randomUUID } from 'node:crypto';
import { mkdir, readdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  DIAGRAM_EXTENSION,
  diagramNameSchema,
  excalidrawSceneSchema,
  type ExcalidrawScene,
} from '../../shared/diagram.ts';

export type DiagramCode = 'INVALID_NAME' | 'INVALID_CONTENT' | 'NOT_FOUND' | 'EXISTS';

export class DiagramError extends Error {
  constructor(
    readonly code: DiagramCode,
    message: string,
  ) {
    super(message);
    this.name = 'DiagramError';
  }
}

export interface DiagramSummary {
  name: string;
  updatedAt: string;
  sizeBytes: number;
}

function isErrno(err: unknown, code: string): boolean {
  return typeof err === 'object' && err !== null && 'code' in err && err.code === code;
}

function parseScene(input: unknown): ExcalidrawScene {
  const parsed = excalidrawSceneSchema.safeParse(input);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    const where = first?.path.length ? `${first.path.join('.')}: ` : '';
    throw new DiagramError(
      'INVALID_CONTENT',
      `Not a valid Excalidraw scene. ${where}${first?.message ?? ''}`,
    );
  }
  return parsed.data;
}

/**
 * Stores diagrams as .excalidraw files in one folder. Every name is validated and resolved
 * inside that folder, so a request can never reach outside it.
 */
export function createDiagramStore(dir: string) {
  const root = path.resolve(dir);

  function fileFor(name: string): string {
    const parsed = diagramNameSchema.safeParse(name);
    if (!parsed.success) {
      throw new DiagramError('INVALID_NAME', parsed.error.issues[0]?.message ?? 'Invalid name');
    }
    const file = path.resolve(root, `${name}${DIAGRAM_EXTENSION}`);
    if (path.dirname(file) !== root) {
      throw new DiagramError('INVALID_NAME', 'Diagram name resolves outside the diagrams folder.');
    }
    return file;
  }

  async function exists(file: string): Promise<boolean> {
    try {
      await stat(file);
      return true;
    } catch (err) {
      if (isErrno(err, 'ENOENT')) return false;
      throw err;
    }
  }

  async function writeAtomic(file: string, scene: ExcalidrawScene): Promise<void> {
    const tmp = `${file}.${randomUUID()}.tmp`;
    try {
      await writeFile(tmp, `${JSON.stringify(scene, null, 2)}\n`, 'utf8');
      await rename(tmp, file);
    } catch (err) {
      await rm(tmp, { force: true });
      throw err;
    }
  }

  async function read(name: string): Promise<ExcalidrawScene> {
    const file = fileFor(name);
    let text: string;
    try {
      text = await readFile(file, 'utf8');
    } catch (err) {
      if (isErrno(err, 'ENOENT'))
        throw new DiagramError('NOT_FOUND', `Diagram "${name}" not found.`);
      throw err;
    }
    let json: unknown;
    try {
      json = JSON.parse(text);
    } catch {
      throw new DiagramError('INVALID_CONTENT', `Diagram "${name}" is not valid JSON.`);
    }
    return parseScene(json);
  }

  async function list(): Promise<DiagramSummary[]> {
    let entries: string[];
    try {
      entries = await readdir(root);
    } catch (err) {
      if (isErrno(err, 'ENOENT')) return [];
      throw err;
    }
    const names = entries
      .filter((entry) => entry.endsWith(DIAGRAM_EXTENSION))
      .map((entry) => entry.slice(0, -DIAGRAM_EXTENSION.length))
      .filter((name) => diagramNameSchema.safeParse(name).success);
    const summaries = await Promise.all(
      names.map(async (name) => {
        const info = await stat(path.join(root, `${name}${DIAGRAM_EXTENSION}`));
        return { name, updatedAt: info.mtime.toISOString(), sizeBytes: info.size };
      }),
    );
    return summaries.sort((a, b) => a.name.localeCompare(b.name));
  }

  async function create(name: string, scene: unknown): Promise<void> {
    const file = fileFor(name);
    const valid = parseScene(scene);
    await mkdir(root, { recursive: true });
    try {
      await writeFile(file, `${JSON.stringify(valid, null, 2)}\n`, {
        encoding: 'utf8',
        flag: 'wx',
      });
    } catch (err) {
      if (isErrno(err, 'EEXIST'))
        throw new DiagramError('EXISTS', `Diagram "${name}" already exists.`);
      throw err;
    }
  }

  async function write(name: string, scene: unknown): Promise<void> {
    const file = fileFor(name);
    const valid = parseScene(scene);
    if (!(await exists(file))) throw new DiagramError('NOT_FOUND', `Diagram "${name}" not found.`);
    await writeAtomic(file, valid);
  }

  async function renameDiagram(from: string, to: string): Promise<void> {
    const source = fileFor(from);
    const target = fileFor(to);
    if (!(await exists(source)))
      throw new DiagramError('NOT_FOUND', `Diagram "${from}" not found.`);
    if (await exists(target)) throw new DiagramError('EXISTS', `Diagram "${to}" already exists.`);
    await rename(source, target);
  }

  async function duplicate(name: string, copyName: string): Promise<void> {
    const scene = await read(name);
    await create(copyName, scene);
  }

  async function remove(name: string): Promise<void> {
    const file = fileFor(name);
    try {
      await rm(file);
    } catch (err) {
      if (isErrno(err, 'ENOENT'))
        throw new DiagramError('NOT_FOUND', `Diagram "${name}" not found.`);
      throw err;
    }
  }

  return { dir: root, list, read, create, write, rename: renameDiagram, duplicate, remove };
}

export type DiagramStore = ReturnType<typeof createDiagramStore>;
