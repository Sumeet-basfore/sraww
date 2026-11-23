// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { Logo } from '../../src/client/brand/Logo.tsx';

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
});
