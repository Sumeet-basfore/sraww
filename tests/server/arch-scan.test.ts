import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/server/app.ts';
import { collectSourceFiles, ScanError } from '../../src/server/arch/collect-files.ts';
import { diffModels } from '../../src/server/arch/diff.ts';
import { listArchProjects } from '../../src/server/arch/projects.ts';
import { scanImports, toRawEdges } from '../../src/server/arch/scan-ts.ts';
import { loadConfig } from '../../src/server/config.ts';
import { createDiagramStore } from '../../src/server/storage/diagram-store.ts';
import type { ArchModel } from '../../src/shared/arch-model.ts';

const HOST = '127.0.0.1:4317';
const SAMPLE = path.resolve('tests/fixtures/sample-project');
let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(path.join(os.tmpdir(), 'sraww-scan-'));
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe('collectSourceFiles', () => {
  it('keeps source files and skips dependency, build and hidden folders', async () => {
    await mkdir(path.join(dir, 'src'), { recursive: true });
    await mkdir(path.join(dir, 'node_modules/pkg'), { recursive: true });
    await mkdir(path.join(dir, 'dist'), { recursive: true });
    await mkdir(path.join(dir, '.git'), { recursive: true });
    await writeFile(path.join(dir, 'src/a.ts'), '');
    await writeFile(path.join(dir, 'src/b.tsx'), '');
    await writeFile(path.join(dir, 'src/types.d.ts'), '');
    await writeFile(path.join(dir, 'src/readme.md'), '');
    await writeFile(path.join(dir, 'node_modules/pkg/index.js'), '');
    await writeFile(path.join(dir, 'dist/out.js'), '');
    await writeFile(path.join(dir, '.git/hook.js'), '');
    expect(await collectSourceFiles(dir, 100)).toEqual(['src/a.ts', 'src/b.tsx']);
  });

  it('stops with TOO_MANY_FILES past the limit', async () => {
    await writeFile(path.join(dir, 'a.ts'), '');
    await writeFile(path.join(dir, 'b.ts'), '');
    const error = await collectSourceFiles(dir, 1).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ScanError);
    expect(error).toMatchObject({ code: 'TOO_MANY_FILES' });
  });
});

describe('scanImports', () => {
  it('reports file imports and package imports from the sample project', async () => {
    const files = ['src/app.ts', 'src/lib/util.ts'];
    const edges = await scanImports(SAMPLE, files, 60_000);
    expect(edges).toContainEqual({ from: 'src/app.ts', to: 'src/lib/util.ts', kind: 'file' });
    expect(edges).toContainEqual(
      expect.objectContaining({ from: 'src/app.ts', to: 'express', kind: 'package' }),
    );
    expect(edges.some((e) => e.kind === 'package' && e.to === 'fs')).toBe(true);
  });

  it('never reports files that are outside the list it was given', async () => {
    const edges = await scanImports(SAMPLE, ['src/app.ts'], 60_000);
    expect(edges.every((e) => e.from === 'src/app.ts')).toBe(true);
    expect(edges.some((e) => e.kind === 'file' && e.to === 'src/lib/util.ts')).toBe(false);
  });
});

describe('toRawEdges', () => {
  it('keeps resolved project files and packages, and drops unresolved relative imports', () => {
    const edges = toRawEdges(
      [
        {
          source: 'a.ts',
          dependencies: [
            {
              module: './b',
              resolved: 'b.ts',
              coreModule: false,
              dependencyTypes: ['local'],
              couldNotResolve: false,
            },
            {
              module: './missing',
              resolved: '',
              coreModule: false,
              dependencyTypes: [],
              couldNotResolve: true,
            },
            {
              module: 'react',
              resolved: 'node_modules/react/index.js',
              coreModule: false,
              dependencyTypes: ['npm'],
              couldNotResolve: false,
            },
            {
              module: 'fs',
              resolved: 'fs',
              coreModule: true,
              dependencyTypes: ['core'],
              couldNotResolve: false,
            },
          ],
        },
      ],
      new Set(['a.ts', 'b.ts']),
    );
    expect(edges).toEqual([
      { from: 'a.ts', to: 'b.ts', kind: 'file' },
      { from: 'a.ts', to: 'react', kind: 'package' },
      { from: 'a.ts', to: 'fs', kind: 'package' },
    ]);
  });
});

describe('listArchProjects', () => {
  it('uses only absolute paths and gives each project a unique id', () => {
    const projects = listArchProjects('/work/app, relative/path, /other/app');
    expect(projects.map((p) => p.id)).toEqual(['app', 'app-2']);
    expect(projects.map((p) => p.label)).toEqual(['app', 'app']);
  });

  it('returns nothing when no projects are configured', () => {
    expect(listArchProjects('')).toEqual([]);
  });
});

describe('diffModels', () => {
  const model = (ids: string[], edges: Array<[string, string]>): ArchModel => ({
    version: 1,
    sourceLabel: 'x',
    generatedAt: '',
    nodes: ids.map((id) => ({
      id,
      label: id,
      kind: 'component',
      group: null,
      files: 0,
      members: [],
    })),
    edges: edges.map(([from, to]) => ({ from, to, count: 1 })),
    groups: [],
  });

  it('reports nothing to compare on the first scan', () => {
    expect(diffModels(null, model(['a'], []))).toMatchObject({
      hasBaseline: false,
      addedNodes: [],
    });
  });

  it('lists added and removed components and dependencies', () => {
    const diff = diffModels(model(['a', 'b'], [['a', 'b']]), model(['a', 'c'], [['a', 'c']]));
    expect(diff).toEqual({
      hasBaseline: true,
      addedNodes: ['c'],
      removedNodes: ['b'],
      addedEdges: ['a → c'],
      removedEdges: ['a → b'],
    });
  });
});

describe('POST /api/arch/scan', () => {
  it('scans an allowed project, stores the model, and reports the change on re-scan', async () => {
    const app = createApp(
      loadConfig({ ARCH_PROJECTS: SAMPLE }),
      createDiagramStore(dir),
      path.join(dir, 'none'),
    );

    const first = await request(app)
      .post('/api/arch/scan')
      .set('Host', HOST)
      .send({ projectId: 'sample-project', name: 'sample map' });
    expect(first.status).toBe(200);
    const ids = first.body.model.nodes.map((n: { id: string }) => n.id);
    expect(ids).toEqual(expect.arrayContaining(['src', 'ext:express']));
    expect(first.body.diff.hasBaseline).toBe(false);

    const again = await request(app)
      .post('/api/arch/scan')
      .set('Host', HOST)
      .send({ projectId: 'sample-project', name: 'sample map' });
    expect(again.body.diff.hasBaseline).toBe(true);
    expect(again.body.diff.addedNodes).toEqual([]);

    const stored = await request(app).get('/api/arch/models/sample%20map').set('Host', HOST);
    expect(stored.status).toBe(200);
  });

  it('refuses a project that is not on the allow-list', async () => {
    const app = createApp(loadConfig({}), createDiagramStore(dir), path.join(dir, 'none'));
    const res = await request(app)
      .post('/api/arch/scan')
      .set('Host', HOST)
      .send({ projectId: 'anything', name: 'x' });
    expect(res.status).toBe(404);
  });

  it('reports a folder with no source files as a clear error', async () => {
    await writeFile(path.join(dir, 'notes.txt'), 'hi');
    const app = createApp(
      loadConfig({ ARCH_PROJECTS: dir }),
      createDiagramStore(dir),
      path.join(dir, 'none'),
    );
    const res = await request(app)
      .post('/api/arch/scan')
      .set('Host', HOST)
      .send({
        projectId: path
          .basename(dir)
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-|-$/g, ''),
        name: 'empty',
      });
    expect(res.status).toBe(422);
    expect(res.body.code).toBe('NO_SOURCE_FILES');
  });
});
