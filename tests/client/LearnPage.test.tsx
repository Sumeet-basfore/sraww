// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
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

  it('the Take the tour button calls onShowTour', async () => {
    const onShowTour = vi.fn();
    render(<LearnPage onShowTour={onShowTour} />);
    await userEvent.setup().click(screen.getByRole('button', { name: 'Take the tour' }));
    expect(onShowTour).toHaveBeenCalledTimes(1);
  });
});
