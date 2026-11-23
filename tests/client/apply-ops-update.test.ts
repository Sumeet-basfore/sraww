import { describe, expect, it, vi } from 'vitest';
import { applyChatOps, type EditableElement } from '../../src/client/ai/apply-ops.ts';
import { PALETTE } from '../../src/client/ai/style.ts';

vi.mock('@excalidraw/excalidraw', () => import('../mocks/excalidraw.tsx'));

const api = (): EditableElement => ({
  id: 'api',
  type: 'rectangle',
  x: 0,
  y: 0,
  width: 160,
  height: 72,
});
const label = (): EditableElement => ({
  id: 'api-text',
  type: 'text',
  x: 10,
  y: 20,
  width: 100,
  height: 30,
  containerId: 'api',
  text: 'API',
  originalText: 'API',
});

describe('applyChatOps updateNodes', () => {
  it('changes the colour of a shape in place', () => {
    const out = applyChatOps(
      [api(), label()],
      [{ type: 'updateNodes', updates: [{ id: 'api', color: 'red' }] }],
    );
    expect(out.find((el) => el.id === 'api')).toMatchObject({
      strokeColor: PALETTE.red.stroke,
      backgroundColor: PALETTE.red.fill,
    });
  });

  it('relabels a shape by changing the text bound to it', () => {
    const out = applyChatOps(
      [api(), label()],
      [{ type: 'updateNodes', updates: [{ id: 'api', label: 'Gateway' }] }],
    );
    expect(out.find((el) => el.id === 'api-text')).toMatchObject({
      text: 'Gateway',
      originalText: 'Gateway',
    });
    expect(out.find((el) => el.id === 'api')).toMatchObject({ x: 0, y: 0, width: 160 });
  });

  it('leaves shapes the update does not name untouched', () => {
    const other: EditableElement = {
      id: 'db',
      type: 'rectangle',
      x: 300,
      y: 0,
      width: 160,
      height: 72,
    };
    const out = applyChatOps(
      [api(), label(), other],
      [{ type: 'updateNodes', updates: [{ id: 'api', color: 'blue' }] }],
    );
    expect(out.find((el) => el.id === 'db')).toBe(other);
  });
});

describe('applyChatOps relabel keeps text inside its shape', () => {
  it('narrows a long label to the width of its shape', () => {
    const out = applyChatOps(
      [api(), label()],
      [
        {
          type: 'updateNodes',
          updates: [{ id: 'api', label: 'A very long label for the gateway service' }],
        },
      ],
    );
    const text = out.find((el) => el.id === 'api-text')!;
    expect(text.width).toBeLessThanOrEqual(160 - 16);
    expect(text.x).toBeGreaterThanOrEqual(0);
  });
});
