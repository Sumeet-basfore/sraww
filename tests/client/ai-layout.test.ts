import { describe, expect, it } from 'vitest';
import { layoutGraph, sizeFor } from '../../src/client/ai/layout.ts';
import { graphToSkeleton } from '../../src/client/ai/skeleton.ts';
import type { DiagramGraph } from '../../src/shared/ai-schemas.ts';

const GRAPH: DiagramGraph = {
  nodes: [
    { id: 'web', label: 'Web app' },
    { id: 'api', label: 'API', shape: 'ellipse' },
    { id: 'db', label: 'Database', shape: 'diamond' },
  ],
  edges: [
    { from: 'web', to: 'api', label: 'calls' },
    { from: 'api', to: 'db' },
  ],
};

describe('sizeFor', () => {
  it('keeps shapes within a readable width range', () => {
    expect(sizeFor({ id: 'a', label: 'x' }).width).toBe(140);
    expect(sizeFor({ id: 'a', label: 'x'.repeat(200) }).width).toBe(280);
  });
});

describe('layoutGraph', () => {
  it('places each node once and lays edges out top to bottom', async () => {
    const { boxes } = await layoutGraph(GRAPH);
    expect([...boxes.keys()].sort()).toEqual(['api', 'db', 'web']);
    expect(boxes.get('api')!.y).toBeGreaterThan(boxes.get('web')!.y);
    expect(boxes.get('db')!.y).toBeGreaterThan(boxes.get('api')!.y);
  });

  it('never overlaps two boxes', async () => {
    const boxes = [...(await layoutGraph(GRAPH)).boxes.values()];
    for (let i = 0; i < boxes.length; i += 1) {
      for (let j = i + 1; j < boxes.length; j += 1) {
        const a = boxes[i]!;
        const b = boxes[j]!;
        const apart =
          a.x + a.width <= b.x ||
          b.x + b.width <= a.x ||
          a.y + a.height <= b.y ||
          b.y + b.height <= a.y;
        expect(apart).toBe(true);
      }
    }
  });
});

describe('graphToSkeleton', () => {
  it('creates one labelled shape per node, using the requested shape type', async () => {
    const boxes = await layoutGraph(GRAPH);
    const skeleton = graphToSkeleton(GRAPH, boxes);
    const shapes = skeleton.filter((el) => el.type !== 'arrow' && el.type !== 'text');
    expect(shapes.map((s) => [s.id, s.type])).toEqual([
      ['web', 'rectangle'],
      ['api', 'ellipse'],
      ['db', 'diamond'],
    ]);
    expect(shapes[0]).toMatchObject({ label: { text: 'Web app' } });
  });

  it('binds arrows to shapes by id so they follow when moved', async () => {
    const boxes = await layoutGraph(GRAPH);
    const arrows = graphToSkeleton(GRAPH, boxes).filter((el) => el.type === 'arrow');
    expect(arrows).toHaveLength(2);
    expect(arrows[0]).toMatchObject({
      start: { id: 'web' },
      end: { id: 'api' },
    });
    // The label is its own text element at the middle of the arrow, not bound to it.
    expect(
      graphToSkeleton(GRAPH, boxes).find((el) => el.type === 'text' && el.text === 'calls'),
    ).toBeDefined();
    expect(arrows[1]).toMatchObject({ start: { id: 'api' }, end: { id: 'db' } });
    expect(arrows[1]).not.toHaveProperty('label');
  });

  it('skips nodes that have no computed position', () => {
    const skeleton = graphToSkeleton(GRAPH, { boxes: new Map(), frames: new Map() });
    expect(skeleton.filter((el) => el.type !== 'arrow')).toHaveLength(0);
  });
});
