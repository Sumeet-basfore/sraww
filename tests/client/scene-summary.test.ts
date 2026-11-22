import { describe, expect, it } from 'vitest';
import { summarizeScene } from '../../src/client/ai/scene-summary.ts';

const ELEMENTS = [
  { id: 'api', type: 'rectangle' },
  { id: 'db', type: 'ellipse' },
  { id: 'api-label', type: 'text', containerId: 'api', text: 'API' },
  { id: 'db-label', type: 'text', containerId: 'db', text: 'Database' },
  {
    id: 'arrow1',
    type: 'arrow',
    startBinding: { elementId: 'api' },
    endBinding: { elementId: 'db' },
  },
  { id: 'loose', type: 'arrow', startBinding: null, endBinding: null },
  { id: 'gone', type: 'rectangle', isDeleted: true },
];

describe('summarizeScene', () => {
  it('lists live shapes with their labels and skips deleted ones', () => {
    const summary = summarizeScene(ELEMENTS);
    expect(summary.shapes).toEqual([
      { id: 'api', kind: 'rectangle', label: 'API' },
      { id: 'db', kind: 'ellipse', label: 'Database' },
    ]);
  });

  it('describes arrows by the shapes they are glued to, or null when not glued', () => {
    const summary = summarizeScene(ELEMENTS);
    expect(summary.arrows).toEqual([
      { id: 'arrow1', from: 'api', to: 'db', label: null },
      { id: 'loose', from: null, to: null, label: null },
    ]);
  });

  it('restricts the summary to a selection when one is given', () => {
    const summary = summarizeScene(ELEMENTS, new Set(['db']));
    expect(summary.shapes.map((s) => s.id)).toEqual(['db']);
    expect(summary.arrows).toEqual([]);
  });

  it('gives an empty summary for an empty drawing', () => {
    expect(summarizeScene([])).toEqual({ shapes: [], arrows: [] });
  });
});
