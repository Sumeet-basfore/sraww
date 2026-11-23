// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { Logo } from '../../src/client/brand/Logo.tsx';

const symbolSvg = readFileSync('brand/logo/sraww-symbol.svg', 'utf8');
const styles = readFileSync('src/client/styles.css', 'utf8');

afterEach(() => {
  cleanup();
});

describe('Logo', () => {
  it('labels the full lockup as sraww and draws the frame and wordmark', () => {
    // Arrange, Act
    const { container } = render(<Logo />);

    // Assert
    expect(screen.getByRole('img', { name: 'sraww' })).toBeInTheDocument();
    expect(container.querySelectorAll('path')).toHaveLength(2);
    expect(container.querySelector('.brand-wordmark')).not.toBeNull();
  });

  it('draws only the symbol when asked for the symbol variant', () => {
    // Arrange, Act
    const { container } = render(<Logo variant="symbol" />);

    // Assert
    expect(screen.getByRole('img', { name: 'sraww' })).toBeInTheDocument();
    expect(container.querySelectorAll('path')).toHaveLength(1);
    expect(container.querySelector('.brand-wordmark')).toBeNull();
  });

  it('matches the finalized frame and point geometry', () => {
    const { container } = render(<Logo variant="symbol" />);
    const sourcePath = symbolSvg.match(/<path d="([^"]+)"/)?.[1];
    const frame = container.querySelector('.brand-frame');
    const sourcePoint = symbolSvg.match(/<circle cx="([^"]+)" cy="([^"]+)" r="([^"]+)"/);
    const point = container.querySelector('.brand-point');
    expect(frame?.getAttribute('d')).toBe(sourcePath);
    expect(point?.getAttribute('cx')).toBe(sourcePoint?.[1]);
    expect(point?.getAttribute('cy')).toBe(sourcePoint?.[2]);
    expect(point?.getAttribute('r')).toBe(sourcePoint?.[3]);
  });

  it('defines theme-aware colour rules for every logo element class', () => {
    for (const selector of ['.brand-frame', '.brand-point', '.brand-wordmark']) {
      expect(styles).toMatch(new RegExp(`${selector.replace('.', '\\.')}\\s*\\{[^}]+\\}`));
    }
    expect(styles).toContain('--brand-symbol: #4f46e5');
    expect(styles).toContain('--brand-symbol: #8d8af7');
    expect(styles).toContain('--brand-wordmark: #f6f5f1');
  });
});
