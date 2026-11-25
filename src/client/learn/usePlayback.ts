import { useEffect, useReducer, useState } from 'react';
import {
  initialPlayback,
  type PlaybackAction,
  playbackReducer,
  type PlaybackOptions,
  type PlaybackState,
  STEP_INTERVAL_MS,
} from './playback.ts';

interface UsePlaybackInput extends PlaybackOptions {
  /** The timer waits until the canvas is on screen, so the build starts with the drawing. */
  ready: boolean;
}

export function usePrefersReducedMotion(): boolean {
  const [reduced] = useState(
    () =>
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  );
  return reduced;
}

export function usePlayback({ total, reducedMotion, ready }: UsePlaybackInput) {
  const options: PlaybackOptions = { total, reducedMotion };
  const [state, dispatch] = useReducer(
    (current: PlaybackState, action: PlaybackAction) => playbackReducer(current, action, options),
    options,
    initialPlayback,
  );

  useEffect(() => {
    if (!ready || !state.playing) return undefined;
    const timer = window.setInterval(() => dispatch({ type: 'tick' }), STEP_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [ready, state.playing]);

  return { shown: state.shown, playing: state.playing, dispatch };
}
