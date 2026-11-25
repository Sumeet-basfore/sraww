import { useEffect } from 'react';
import type { PlaybackAction } from './playback.ts';

interface BuildControlsProps {
  shown: number;
  total: number;
  playing: boolean;
  reducedMotion: boolean;
  dispatch: (action: PlaybackAction) => void;
}

const TYPING_TAGS = ['INPUT', 'TEXTAREA', 'SELECT'];

/** Keys typed into a field, or aimed at the canvas, are not steps. */
function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.isContentEditable ||
    TYPING_TAGS.includes(target.tagName) ||
    !!target.closest('.excalidraw')
  );
}

/** The toolbar under the lesson canvas: Replay, Back, Play or Pause, Next, Skip to end. */
export function BuildControls({
  shown,
  total,
  playing,
  reducedMotion,
  dispatch,
}: BuildControlsProps) {
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent): void {
      if (event.altKey || event.ctrlKey || event.metaKey || isTyping(event.target)) return;
      if (event.key === 'ArrowRight') dispatch({ type: 'next' });
      if (event.key === 'ArrowLeft') dispatch({ type: 'back' });
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [dispatch]);

  const atStart = shown === 0;
  const atEnd = shown === total;
  return (
    <div className="build-controls" role="group" aria-label="Build-up controls">
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
      <p className="build-step" aria-live="polite">
        {`Step ${shown} of ${total}`}
      </p>
    </div>
  );
}
