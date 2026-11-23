import { describe, expect, it } from 'vitest';
import {
  axesSkeleton,
  numberLineSkeleton,
  tableSkeleton,
} from '../../src/client/math/templates.ts';

describe('math templates', () => {
  it('draws axes with unit ticks inside the requested box', () => {
    const items = axesSkeleton({ x: 100, y: 50, width: 400, height: 300, step: 50 });

    expect(items.filter((item) => item.type === 'line').length).toBeGreaterThan(8);
    expect(items[0]).toMatchObject({ x: 100, y: 50 });
  });

  it('labels the number line at each end', () => {
    const items = numberLineSkeleton({ x: 0, y: 0, width: 300, step: 50 });

    expect(items.filter((item) => item.type === 'text').length).toBeGreaterThanOrEqual(3);
  });

  it('builds a 3x3 table as a frame of lines, not loose rectangles', () => {
    const items = tableSkeleton({ x: 0, y: 0, width: 300, height: 120, rows: 3, cols: 3 });

    expect(items.filter((item) => item.type === 'line')).toHaveLength(4 + 4);
  });
});
