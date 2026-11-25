// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BuildControls } from '../../src/client/learn/BuildControls.tsx';
import { usePlayback } from '../../src/client/learn/usePlayback.ts';

interface HarnessProps {
  total?: number;
  reducedMotion?: boolean;
}

/** The controls wired to the real playback hook, so tests see what a learner sees. */
function Harness({ total = 3, reducedMotion = false }: HarnessProps) {
  const playback = usePlayback({ total, reducedMotion, ready: true });
  return (
    <>
      <input aria-label="Notes" />
      <div className="excalidraw">
        <button type="button">Inside the canvas</button>
      </div>
      <BuildControls
        shown={playback.shown}
        total={total}
        playing={playback.playing}
        reducedMotion={reducedMotion}
        dispatch={playback.dispatch}
      />
    </>
  );
}

function controls(): HTMLElement {
  return screen.getByRole('group', { name: 'Build-up controls' });
}

function button(name: string): HTMLButtonElement {
  return within(controls()).getByRole('button', { name }) as HTMLButtonElement;
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('BuildControls labels and order', () => {
  it('offers Replay, Back, Play or Pause, Next and Skip to end, in that order', () => {
    render(<Harness />);
    const names = within(controls())
      .getAllByRole('button')
      .map((el) => el.textContent);
    expect(names).toEqual(['Replay', 'Back', 'Pause', 'Next', 'Skip to end']);
  });

  it('announces the step politely as it changes', () => {
    render(<Harness />);
    const step = screen.getByText('Step 0 of 3');
    expect(step).toHaveAttribute('aria-live', 'polite');
  });

  it('shows Pause while the build plays and Play once it is paused', () => {
    render(<Harness />);
    expect(button('Pause')).toBeEnabled();
    fireEvent.click(button('Pause'));
    expect(button('Play')).toBeEnabled();
  });
});

describe('BuildControls disabled states', () => {
  it('disables Back at the first step', () => {
    render(<Harness />);
    expect(button('Back')).toBeDisabled();
  });

  it('disables Next and Skip to end once every step is shown', () => {
    render(<Harness />);
    fireEvent.click(button('Skip to end'));
    expect(screen.getByText('Step 3 of 3')).toBeInTheDocument();
    expect(button('Next')).toBeDisabled();
    expect(button('Skip to end')).toBeDisabled();
    expect(button('Back')).toBeEnabled();
  });
});

describe('BuildControls stepping', () => {
  it('moves Next and Back one step at a time', () => {
    render(<Harness />);
    fireEvent.click(button('Next'));
    fireEvent.click(button('Next'));
    expect(screen.getByText('Step 2 of 3')).toBeInTheDocument();
    fireEvent.click(button('Back'));
    expect(screen.getByText('Step 1 of 3')).toBeInTheDocument();
  });

  it('returns to step 0 on Replay', () => {
    render(<Harness />);
    fireEvent.click(button('Skip to end'));
    fireEvent.click(button('Replay'));
    expect(screen.getByText('Step 0 of 3')).toBeInTheDocument();
  });

  it('lets Next work while the build is paused', () => {
    render(<Harness />);
    fireEvent.click(button('Pause'));
    fireEvent.click(button('Next'));
    expect(screen.getByText('Step 1 of 3')).toBeInTheDocument();
    expect(button('Play')).toBeEnabled();
  });
});

describe('BuildControls arrow keys', () => {
  it('steps forward on Right and back on Left', () => {
    render(<Harness />);
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(screen.getByText('Step 2 of 3')).toBeInTheDocument();
    fireEvent.keyDown(window, { key: 'ArrowLeft' });
    expect(screen.getByText('Step 1 of 3')).toBeInTheDocument();
  });

  it('ignores arrow keys typed into a field', () => {
    render(<Harness />);
    fireEvent.keyDown(screen.getByRole('textbox', { name: 'Notes' }), { key: 'ArrowRight' });
    expect(screen.getByText('Step 0 of 3')).toBeInTheDocument();
  });

  it('ignores arrow keys aimed inside the canvas', () => {
    render(<Harness />);
    fireEvent.keyDown(screen.getByRole('button', { name: 'Inside the canvas' }), {
      key: 'ArrowRight',
    });
    expect(screen.getByText('Step 0 of 3')).toBeInTheDocument();
  });

  it('ignores arrow keys pressed with a modifier, which belong to the browser', () => {
    render(<Harness />);
    fireEvent.keyDown(window, { key: 'ArrowLeft', altKey: true });
    expect(screen.getByText('Step 0 of 3')).toBeInTheDocument();
  });
});

describe('BuildControls with reduced motion', () => {
  it('starts with every step shown and no Play control to start it', () => {
    render(<Harness reducedMotion />);
    expect(screen.getByText('Step 3 of 3')).toBeInTheDocument();
    expect(button('Play')).toBeDisabled();
  });

  it('still lets the learner step back through the build', () => {
    render(<Harness reducedMotion />);
    fireEvent.click(button('Replay'));
    expect(screen.getByText('Step 0 of 3')).toBeInTheDocument();
    fireEvent.click(button('Next'));
    expect(screen.getByText('Step 1 of 3')).toBeInTheDocument();
    expect(button('Play')).toBeDisabled();
  });
});
