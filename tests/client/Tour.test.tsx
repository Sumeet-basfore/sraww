// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Tour } from '../../src/client/tour/Tour.tsx';
import { hasSeenTour, markTourSeen } from '../../src/client/tour/tour-state.ts';
import { TOUR_STEPS } from '../../src/client/tour/tour-steps.ts';

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  window.localStorage.clear();
});

describe('Tour', () => {
  it('shows the first step as a dialog when open', () => {
    render(<Tour open onClose={() => undefined} />);
    const dialog = screen.getByRole('dialog', { name: TOUR_STEPS[0]?.title });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(screen.getByText(`Step 1 of ${TOUR_STEPS.length}`)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Back' })).toBeDisabled();
  });

  it('renders nothing when closed', () => {
    render(<Tour open={false} onClose={() => undefined} />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('moves forward and back through the steps', async () => {
    render(<Tour open onClose={() => undefined} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByRole('dialog', { name: TOUR_STEPS[1]?.title })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Back' }));
    expect(screen.getByRole('dialog', { name: TOUR_STEPS[0]?.title })).toBeInTheDocument();
  });

  it('finishes on the last step, closes, and remembers that it was seen', async () => {
    const onClose = vi.fn();
    render(<Tour open onClose={onClose} />);
    const user = userEvent.setup();
    for (let i = 0; i < TOUR_STEPS.length - 1; i += 1) {
      await user.click(screen.getByRole('button', { name: 'Next' }));
    }
    await user.click(screen.getByRole('button', { name: 'Finish' }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(hasSeenTour()).toBe(true);
  });

  it('closes on Escape and marks the tour as seen', async () => {
    const onClose = vi.fn();
    render(<Tour open onClose={onClose} />);
    await userEvent.setup().keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(hasSeenTour()).toBe(true);
  });

  it('skips from any step and marks the tour as seen', async () => {
    const onClose = vi.fn();
    render(<Tour open onClose={onClose} />);
    await userEvent.setup().click(screen.getByRole('button', { name: 'Skip tour' }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(hasSeenTour()).toBe(true);
  });

  it('still closes when storage refuses writes', async () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota');
    });
    const onClose = vi.fn();
    render(<Tour open onClose={onClose} />);
    await userEvent.setup().click(screen.getByRole('button', { name: 'Skip tour' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe('tour-state', () => {
  it('reports unseen when storage cannot be read', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(hasSeenTour()).toBe(false);
  });

  it('remembers a seen tour across reads', () => {
    expect(hasSeenTour()).toBe(false);
    markTourSeen();
    expect(hasSeenTour()).toBe(true);
  });
});
