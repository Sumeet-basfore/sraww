import { describe, expect, it } from 'vitest';
import {
  archSkeleton,
  archToGraph,
  elementIds,
  groupFrames,
  mergeBoxes,
  renderArchitecture,
} from '../../src/client/arch/render.ts';
import type { ArchModel } from '../../src/shared/arch-model.ts';

const MODEL: ArchModel = {
  version: 1,
  sourceLabel: 'demo',
  generatedAt: '2026-01-01T00:00:00.000Z',
  nodes: [
    {
      id: 'src/client',
      label: 'src/client',
      kind: 'component',
      group: 'src',
      files: 1,
      members: [],
    },
    {
      id: 'src/server',
      label: 'src/server',
      kind: 'component',
      group: 'src',
      files: 1,
      members: [],
    },
    { id: 'ext:express', label: 'express', kind: 'external', group: null, files: 0, members: [] },
  ],
  edges: [
    { from: 'src/client', to: 'src/server', count: 3 },
    { from: 'src/server', to: 'ext:express', count: 1 },
  ],
  groups: [{ id: 'src', label: 'src', members: ['src/client', 'src/server'] }],
};

const BOXES = new Map([
  ['src/client', { x: 0, y: 0, width: 140, height: 72 }],
  ['src/server', { x: 0, y: 200, width: 140, height: 72 }],
  ['ext:express', { x: 0, y: 400, width: 140, height: 72 }],
]);

describe('archToGraph', () => {
  it('maps externals to ellipses and labels repeated edges with their count', () => {
    const graph = archToGraph(MODEL);
    expect(graph.nodes.find((n) => n.id === 'ext:express')?.shape).toBe('ellipse');
    expect(graph.edges[0]?.label).toBe('3');
    expect(graph.edges[1]?.label).toBeUndefined();
  });
});

describe('mergeBoxes', () => {
  it('uses saved positions and keeps computed sizes; ignores positions for removed nodes', () => {
    const merged = mergeBoxes(BOXES, {
      'src/client': { x: 900, y: 50 },
      gone: { x: 1, y: 1 },
    });
    expect(merged.get('src/client')).toEqual({ x: 900, y: 50, width: 140, height: 72 });
    expect(merged.get('src/server')).toEqual(BOXES.get('src/server'));
    expect(merged.has('gone')).toBe(false);
  });
});

describe('groupFrames', () => {
  it('draws one frame around the members of each group, with room for the title', () => {
    const [frame] = groupFrames(MODEL, BOXES);
    expect(frame?.id).toBe('src');
    expect(frame?.box.y).toBeLessThan(0);
    expect(frame?.box.height).toBeGreaterThan(200);
  });
});

describe('archSkeleton', () => {
  it('uses stable ids and glues each arrow to its two components', () => {
    const skeleton = archSkeleton(MODEL, BOXES);
    const arrow = skeleton.find((el) => el.id === elementIds.edge('src/client', 'src/server'));
    expect(arrow).toMatchObject({
      type: 'arrow',
      start: { id: 'node:src/client' },
      end: { id: 'node:src/server' },
      label: { text: '3' },
    });
    expect(skeleton.find((el) => el.id === 'node:ext:express')).toMatchObject({ type: 'ellipse' });
  });

  it('draws frames before nodes so frames sit behind them', () => {
    const ids = archSkeleton(MODEL, BOXES).map((el) => el.id);
    expect(ids.indexOf('group:src')).toBeLessThan(ids.indexOf('node:src/client'));
  });
});

describe('renderArchitecture', () => {
  it('lays out every node with ELK and applies a saved position', async () => {
    const { skeleton, boxes } = await renderArchitecture(MODEL, {
      version: 1,
      positions: { 'ext:express': { x: 777, y: 888 } },
    });
    expect([...boxes.keys()].sort()).toEqual(['ext:express', 'src/client', 'src/server']);
    expect(boxes.get('ext:express')).toMatchObject({ x: 777, y: 888 });
    expect(skeleton.length).toBeGreaterThan(0);
  });
});
