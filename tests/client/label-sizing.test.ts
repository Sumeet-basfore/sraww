import { describe, expect, it } from 'vitest';
import { measureLabel, sizeLabel } from '../../src/client/ai/label-sizing.ts';

describe('shared label sizing', () => {
  it('keeps short labels at the practical minimum width', () => {
    expect(sizeLabel('API')).toMatchObject({ width: 200, height: 72, lines: ['API'] });
  });

  it('wraps long labels at spaces and grows height for each line', () => {
    const size = sizeLabel('Background Processing Queue');
    expect(size.lines).toEqual(['Background', 'Processing Queue']);
    expect(size.height).toBeGreaterThan(72);
  });

  it('widens for an unbreakable word instead of splitting it', () => {
    const label = 'X'.repeat(100);
    const size = sizeLabel(label);
    expect(size.lines).toEqual([label]);
    expect(size.width).toBeGreaterThan(400);
  });

  it('gives diamonds and ellipses wider boxes for their narrower usable area', () => {
    const rect = sizeLabel('Background Processing Queue', 'rectangle');
    expect(sizeLabel('Background Processing Queue', 'diamond').width).toBeGreaterThan(rect.width);
    expect(sizeLabel('Background Processing Queue', 'ellipse').width).toBeGreaterThan(rect.width);
  });

  it('uses a deterministic font metric without a DOM', () => {
    expect(measureLabel('abcd', 18)).toBeCloseTo(41.76);
  });
});
