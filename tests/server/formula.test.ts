import { describe, expect, it, vi } from 'vitest';
import MathJax from 'mathjax';
import { DiagramError } from '../../src/server/storage/diagram-store.ts';
import { renderFormula } from '../../src/server/math/render-formula.ts';

describe('renderFormula', () => {
  it('initializes MathJax once across multiple renders', async () => {
    const init = vi.spyOn(MathJax, 'init');

    await renderFormula('x');
    await renderFormula('y');

    expect(init).toHaveBeenCalledTimes(1);
  });

  it('returns a self-contained SVG and dimensions matching its viewBox', async () => {
    const result = await renderFormula('x^2+1', 20);
    const viewBox = result.svg.match(/viewBox="[^"]*?([\d.]+) ([\d.]+)"/);

    expect(result.svg).toContain('<path');
    // The SVG namespace must stay: a data:image/svg+xml image will not render without it.
    expect(result.svg).toContain('xmlns="http://www.w3.org/2000/svg"');
    // No external reference may be fetched, and no HTML wrapper may be embedded.
    expect(result.svg).not.toMatch(/(?:href|src)="https?:|foreignObject/i);
    expect(result.width).toBeGreaterThan(0);
    expect(result.height).toBeGreaterThan(0);
    expect(viewBox).not.toBeNull();
    if (!viewBox) throw new Error('SVG is missing a viewBox');
    const [, viewWidth, viewHeight] = viewBox;
    expect(result.width).toBeCloseTo((Number(viewWidth) / 1000) * 20, 0);
    expect(result.height).toBeCloseTo((Number(viewHeight) / 1000) * 20, 0);
  });

  it.each(['', 'x'.repeat(501)])('rejects invalid input %j', async (latex) => {
    await expect(renderFormula(latex)).rejects.toMatchObject({
      code: 'INVALID_CONTENT',
    });
    await expect(renderFormula(latex)).rejects.toBeInstanceOf(DiagramError);
  });

  it('maps invalid TeX to INVALID_CONTENT', async () => {
    await expect(renderFormula('\\frac{')).rejects.toMatchObject({
      code: 'INVALID_CONTENT',
    });
    await expect(renderFormula('\\frac{')).rejects.toBeInstanceOf(DiagramError);
  });

  it('clamps font size to 120', async () => {
    const large = await renderFormula('x^2+1', 200);
    const viewBox = large.svg.match(/viewBox="[-\d.]+\s+[-\d.]+\s+([\d.]+)\s+([\d.]+)"/);

    expect(viewBox).not.toBeNull();
    if (!viewBox) throw new Error('SVG is missing a viewBox');
    expect(large.width).toBeCloseTo((Number(viewBox[1]) / 1000) * 120, 0);
    expect(large.height).toBeCloseTo((Number(viewBox[2]) / 1000) * 120, 0);
  });
});
