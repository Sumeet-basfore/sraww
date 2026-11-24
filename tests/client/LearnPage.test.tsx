// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { LearnPage } from '../../src/client/learn/LearnPage.tsx';

afterEach(() => cleanup());

describe('LearnPage', () => {
  it('says plainly that Learn is not ready, with the Learn tab marked current', () => {
    render(<LearnPage onShowTour={() => undefined} />);
    expect(screen.getByRole('heading', { name: 'Learn', level: 1 })).toBeInTheDocument();
    expect(screen.getByText(/It is not ready yet/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Learn' })).toHaveAttribute('aria-current', 'page');
  });

  it('lists the four top-level tabs in order', () => {
    render(<LearnPage onShowTour={() => undefined} />);
    const tabs = screen.getByRole('navigation', { name: 'Main' }).querySelectorAll('a');
    expect([...tabs].map((tab) => tab.textContent)).toEqual([
      'Drawings',
      'Learn',
      'Architecture',
      'AI tools',
    ]);
  });
});
