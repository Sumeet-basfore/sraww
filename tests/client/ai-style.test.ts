import { describe, expect, it, vi } from 'vitest';
import { graphToSkeleton } from '../../src/client/ai/skeleton.ts';
import { layoutGraph } from '../../src/client/ai/layout.ts';
import { arrowStyle, edgeLabelSkeleton, PALETTE, shapeStyle } from '../../src/client/ai/style.ts';
import type { DiagramGraph } from '../../src/shared/ai-schemas.ts';

vi.mock('@excalidraw/excalidraw', () => import('../mocks/excalidraw.tsx'));

function luminance(hex: string): number {
  const channels = hex.match(/[0-9a-f]{2}/gi)!.map((value) => parseInt(value, 16) / 255);
  const [r, g, b] = channels.map((value) =>
    value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4,
  );
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}

function contrast(a: string, b: string): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light! + 0.05) / (dark! + 0.05);
}

describe('palette text contrast', () => {
  it('keeps all normal-sized labels at WCAG AA contrast on their fills', () => {
    for (const palette of Object.values(PALETTE)) {
      expect(
        contrast(palette.text, palette.fill === 'transparent' ? '#ffffff' : palette.fill),
      ).toBeGreaterThanOrEqual(4.5);
    }
  });
});

describe('edgeLabelSkeleton', () => {
  it('places labels beside vertical shafts', () => {
    const from = { x: 0, y: 0, width: 200, height: 72 };
    const to = { x: 10, y: 200, width: 200, height: 72 };
    const label = edgeLabelSkeleton('request', from, to);
    const shaftX = (from.x + from.width / 2 + to.x + to.width / 2) / 2;
    expect(label.x).toBeGreaterThan(shaftX);
  });

  it('places labels above horizontal shafts with a clear gap', () => {
    const from = { x: 0, y: 0, width: 200, height: 72 };
    const to = { x: 300, y: 10, width: 200, height: 72 };
    const label = edgeLabelSkeleton('request', from, to);
    const shaftY = (from.y + from.height / 2 + to.y + to.height / 2) / 2;
    expect(label.y + 20).toBeLessThan(shaftY);
  });
});

describe('shapeStyle', () => {
  it('draws a rounded node as a rectangle with corners', () => {
    expect(shapeStyle({ shape: 'rounded', color: null })).toMatchObject({
      type: 'rectangle',
      roundness: { type: 3 },
    });
  });

  it('draws a note as a rectangle with no visible border or fill', () => {
    expect(shapeStyle({ shape: 'note', color: 'red' })).toMatchObject({
      strokeColor: 'transparent',
      backgroundColor: 'transparent',
    });
  });

  it('uses the chosen colour for the border and the soft fill', () => {
    expect(shapeStyle({ shape: 'ellipse', color: 'green' })).toMatchObject({
      type: 'ellipse',
      strokeColor: PALETTE.green.stroke,
      backgroundColor: PALETTE.green.fill,
    });
  });

  it('keeps the default rectangle when nothing is chosen', () => {
    expect(shapeStyle({ shape: null, color: null })).toMatchObject({
      type: 'rectangle',
      strokeColor: PALETTE.neutral.stroke,
      roundness: null,
    });
  });
});

describe('arrowStyle', () => {
  it('uses a solid line with one head by default', () => {
    expect(arrowStyle({ style: null, arrow: null })).toEqual({
      strokeStyle: 'solid',
      startArrowhead: null,
      endArrowhead: 'arrow',
    });
  });

  it('draws dashed lines, heads at both ends, or a plain line', () => {
    expect(arrowStyle({ style: 'dashed', arrow: 'both' })).toEqual({
      strokeStyle: 'dashed',
      startArrowhead: 'arrow',
      endArrowhead: 'arrow',
    });
    expect(arrowStyle({ style: null, arrow: 'none' })).toMatchObject({ endArrowhead: null });
  });
});

describe('layoutGraph with groups and direction', () => {
  const grouped: DiagramGraph = {
    nodes: [
      { id: 'api', label: 'API', group: 'Backend' },
      { id: 'db', label: 'Database', group: 'Backend' },
      { id: 'web', label: 'Web' },
    ],
    edges: [{ from: 'web', to: 'api' }],
    direction: null,
    title: null,
  };

  it('draws grouped nodes inside one frame that contains them', async () => {
    const { boxes, frames } = await layoutGraph(grouped);
    const frame = frames.get('Backend');
    expect(frame).toBeDefined();
    for (const id of ['api', 'db']) {
      const box = boxes.get(id)!;
      expect(box.x).toBeGreaterThanOrEqual(frame!.x);
      expect(box.y).toBeGreaterThanOrEqual(frame!.y);
      expect(box.x + box.width).toBeLessThanOrEqual(frame!.x + frame!.width);
      expect(box.y + box.height).toBeLessThanOrEqual(frame!.y + frame!.height);
    }
    expect(frames.has('web')).toBe(false);
  });

  it('lays the diagram out left to right when asked', async () => {
    const { boxes } = await layoutGraph({
      nodes: [
        { id: 'a', label: 'A' },
        { id: 'b', label: 'B' },
      ],
      edges: [{ from: 'a', to: 'b' }],
      direction: 'right',
      title: null,
    });
    expect(boxes.get('b')!.x).toBeGreaterThan(boxes.get('a')!.x);
  });
});

describe('graphToSkeleton with styles, frames and a title', () => {
  it('adds a title, a dashed frame with its name, and styled arrows', async () => {
    const graph: DiagramGraph = {
      nodes: [
        { id: 'api', label: 'API', group: 'Backend', color: 'blue', shape: 'rounded' },
        { id: 'db', label: 'Database', group: 'Backend', shape: 'ellipse' },
      ],
      edges: [{ from: 'api', to: 'db', style: 'dashed', arrow: 'both', label: 'reads' }],
      direction: null,
      title: 'Payments',
    };
    const layout = await layoutGraph(graph);
    const skeleton = graphToSkeleton(graph, layout) as Array<Record<string, unknown>>;

    expect(skeleton.find((el) => el.type === 'text' && el.text === 'Payments')).toBeDefined();
    expect(skeleton.find((el) => el.type === 'text' && el.text === 'Backend')).toBeDefined();
    expect(
      skeleton.find((el) => el.type === 'rectangle' && el.strokeStyle === 'dashed'),
    ).toBeDefined();
    expect(skeleton.find((el) => el.id === 'api')).toMatchObject({
      roundness: { type: 3 },
      strokeColor: PALETTE.blue.stroke,
      label: { strokeColor: PALETTE.blue.text },
    });
    expect(skeleton.find((el) => el.type === 'arrow')).toMatchObject({
      strokeStyle: 'dashed',
      startArrowhead: 'arrow',
      endArrowhead: 'arrow',
    });
  });
});

describe('notes', () => {
  it('draws a note as text, and an arrow to it is not glued to it', async () => {
    const graph: DiagramGraph = {
      nodes: [
        { id: 'api', label: 'API' },
        { id: 'note', label: 'Retries: 3', shape: 'note' },
      ],
      edges: [{ from: 'api', to: 'note', arrow: 'none' }],
      direction: null,
      title: null,
    };
    const skeleton = graphToSkeleton(graph, await layoutGraph(graph)) as Array<
      Record<string, unknown>
    >;
    expect(skeleton.find((el) => el.id === 'note')).toMatchObject({
      type: 'text',
      text: 'Retries: 3',
    });
    const arrow = skeleton.find((el) => el.type === 'arrow');
    expect(arrow).toBeDefined();
    expect(arrow).not.toHaveProperty('end');
    expect(arrow).toHaveProperty('points');
  });
});

describe('note placement', () => {
  it('places a note just to the right of the shape it is joined to', async () => {
    const { boxes } = await layoutGraph({
      nodes: [
        { id: 'api', label: 'API' },
        { id: 'db', label: 'Database' },
        { id: 'note', label: 'Retries', shape: 'note' },
      ],
      edges: [
        { from: 'api', to: 'db' },
        { from: 'api', to: 'note', arrow: 'none' },
      ],
      direction: null,
      title: null,
    });
    const api = boxes.get('api')!;
    const note = boxes.get('note')!;
    expect(note.x).toBeGreaterThan(api.x + api.width);
    expect(Math.abs(note.y + note.height / 2 - (api.y + api.height / 2))).toBeLessThan(40);
  });
});
