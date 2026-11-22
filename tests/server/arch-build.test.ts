import { describe, expect, it } from 'vitest';
import {
  ArchBuildError,
  buildArchModel,
  componentOf,
  packageOf,
  type RawEdge,
} from '../../src/server/arch/build-model.ts';

const META = { sourceLabel: 'demo', generatedAt: '2026-01-01T00:00:00.000Z' };

describe('componentOf and packageOf', () => {
  it('groups files by the first folders, up to the depth', () => {
    expect(componentOf('src/server/ai/x.ts', 2)).toBe('src/server');
    expect(componentOf('src/app.ts', 2)).toBe('src');
    expect(componentOf('index.ts', 2)).toBe('.');
  });

  it('reads the package name from a bare import', () => {
    expect(packageOf('react-dom/client')).toBe('react-dom');
    expect(packageOf('@scope/lib/deep')).toBe('@scope/lib');
    expect(packageOf('node:fs')).toBe('node:fs');
  });
});

describe('buildArchModel', () => {
  const files = [
    'src/server/app.ts',
    'src/server/routes/a.ts',
    'src/client/main.tsx',
    'tools/build.ts',
  ];

  it('makes one component per folder and aggregates edges between them', () => {
    const edges: RawEdge[] = [
      { from: 'src/server/app.ts', to: 'src/server/routes/a.ts', kind: 'file' },
      { from: 'src/client/main.tsx', to: 'src/server/app.ts', kind: 'file' },
      { from: 'src/client/main.tsx', to: 'src/server/routes/a.ts', kind: 'file' },
    ];
    const model = buildArchModel({ files, edges, ...META });
    const ids = model.nodes.map((n) => n.id);
    expect(ids).toEqual(['src/client', 'src/server', 'tools']);
    expect(model.edges).toEqual([{ from: 'src/client', to: 'src/server', count: 2 }]);
  });

  it('skips imports inside the same folder', () => {
    const edges: RawEdge[] = [
      { from: 'src/server/app.ts', to: 'src/server/routes/a.ts', kind: 'file' },
    ];
    const model = buildArchModel({ files, edges, ...META });
    expect(model.edges).toEqual([]);
  });

  it('adds external packages as nodes and connects them to their importers', () => {
    const edges: RawEdge[] = [
      { from: 'src/client/main.tsx', to: 'react-dom/client', kind: 'package' },
      { from: 'src/server/app.ts', to: 'express', kind: 'package' },
    ];
    const model = buildArchModel({ files, edges, ...META });
    const external = model.nodes.filter((n) => n.kind === 'external').map((n) => n.id);
    expect(external).toEqual(['ext:express', 'ext:react-dom']);
    expect(model.edges).toContainEqual({ from: 'src/client', to: 'ext:react-dom', count: 1 });
  });

  it('groups components by their top-level folder', () => {
    const model = buildArchModel({ files, edges: [], ...META });
    const src = model.groups.find((g) => g.id === 'src');
    expect(src?.members).toEqual(['src/client', 'src/server']);
    expect(model.groups.map((g) => g.id)).toEqual(['src', 'tools']);
  });

  it('lists the files of each component, capped', () => {
    const model = buildArchModel({ files, edges: [], ...META });
    const server = model.nodes.find((n) => n.id === 'src/server');
    expect(server?.files).toBe(2);
    expect(server?.members).toEqual(['src/server/app.ts', 'src/server/routes/a.ts']);
  });

  it('refuses to draw more components than the limit', () => {
    const many = Array.from({ length: 201 }, (_, i) => `d${i}/x.ts`);
    expect(() => buildArchModel({ files: many, edges: [], ...META })).toThrow(ArchBuildError);
  });
});
