import { describe, expect, it, vi } from 'vitest';
import { applyChatOps, type EditableElement } from '../../src/client/ai/apply-ops.ts';
import type { ChatOp } from '../../src/shared/chat-schemas.ts';

vi.mock('@excalidraw/excalidraw', () => import('../mocks/excalidraw.tsx'));

function shape(id: string, x: number, y: number): EditableElement {
  return { id, type: 'rectangle', x, y, width: 100, height: 50 };
}

function ofType(elements: EditableElement[], type: string): EditableElement[] {
  return elements.filter((el) => el.type === type && !el.isDeleted);
}

describe('applyChatOps', () => {
  it('adds new shapes in a row below the existing drawing', () => {
    const existing = [shape('api', 0, 0)];
    const ops: ChatOp[] = [{ type: 'addNodes', nodes: [{ id: 'cache', label: 'Cache' }] }];
    const out = applyChatOps(existing, ops);
    const added = ofType(out, 'rectangle').filter((el) => el.id !== 'api');
    expect(added).toHaveLength(1);
    expect(added[0]!.y).toBeGreaterThan(50);
    expect(existing).toHaveLength(1);
  });

  it('glues arrows between two new shapes, and draws arrows to existing shapes unglued', () => {
    const existing = [shape('api', 0, 0)];
    const ops: ChatOp[] = [
      { type: 'addNodes', nodes: [{ id: 'cache', label: 'Cache' }] },
      { type: 'addEdges', edges: [{ from: 'api', to: 'cache', label: 'reads' }] },
    ];
    const arrows = ofType(applyChatOps(existing, ops), 'arrow');
    expect(arrows).toHaveLength(1);
    expect(arrows[0]!.points).toEqual([
      [0, 0],
      [expect.any(Number), expect.any(Number)],
    ]);
  });

  it('marks a deleted shape, its label, and arrows glued to it as deleted', () => {
    const existing: EditableElement[] = [
      shape('api', 0, 0),
      shape('db', 300, 0),
      { id: 'api-label', type: 'text', x: 0, y: 0, width: 10, height: 10, containerId: 'api' },
      {
        id: 'link',
        type: 'arrow',
        x: 0,
        y: 0,
        width: 10,
        height: 10,
        startBinding: { elementId: 'api' },
        endBinding: { elementId: 'db' },
      },
    ];
    const out = applyChatOps(existing, [{ type: 'deleteElements', ids: ['api'] }]);
    const liveIds = out.filter((el) => !el.isDeleted).map((el) => el.id);
    expect(liveIds).toEqual(['db']);
  });

  it('returns the list unchanged when there are no ops', () => {
    const existing = [shape('api', 0, 0)];
    expect(applyChatOps(existing, [])).toEqual(existing);
  });
});
