import type { KeyboardEvent } from 'react';
import type { PlaybackAction } from './playback.ts';

interface BuildControlsProps {
  shown: number;
  total: number;
  playing: boolean;
  reducedMotion: boolean;
  dispatch: (action: PlaybackAction) => void;
}

const STEP_KEYS: Record<string, PlaybackAction['type']> = {
  ArrowRight: 'next',
  ArrowLeft: 'back',
};

/** The toolbar under the lesson canvas: Replay, Back, Play or Pause, Next, Skip to end. */
export function BuildControls({
  shown,
  total,
  playing,
  reducedMotion,
  dispatch,
}: BuildControlsProps) {
  // Arrow keys step only while focus is on these controls, so page scrolling is left alone.
  function onKeyDown(event: KeyboardEvent<HTMLDivElement>): void {
    const type = STEP_KEYS[event.key];
    if (!type || event.altKey || event.ctrlKey || event.metaKey) return;
    event.preventDefault();
    dispatch({ type });
  }

  const atStart = shown === 0;
  const atEnd = shown === total;
  return (
    <div
      className="build-controls"
      role="group"
      aria-label="Build-up controls"
      onKeyDown={onKeyDown}
    >
      <button type="button" className="button" onClick={() => dispatch({ type: 'replay' })}>
        Replay
      </button>
      <button
        type="button"
        className="button"
        disabled={atStart}
        onClick={() => dispatch({ type: 'back' })}
      >
        Back
      </button>
      <button
        type="button"
        className="button"
        disabled={reducedMotion}
        onClick={() => dispatch({ type: 'toggle' })}
      >
        {playing ? 'Pause' : 'Play'}
      </button>
      <button
        type="button"
        className="button"
        disabled={atEnd}
        onClick={() => dispatch({ type: 'next' })}
      >
        Next
      </button>
      <button
        type="button"
        className="button"
        disabled={atEnd}
        onClick={() => dispatch({ type: 'skipToEnd' })}
      >
        Skip to end
      </button>
      {/* Silent while playing, so the screen reader is not told every step; announced when paused. */}
      <p className="build-step" aria-live={playing ? 'off' : 'polite'}>
        {`Step ${shown} of ${total}`}
      </p>
    </div>
  );
}
