// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  initialPlayback,
  type PlaybackAction,
  type PlaybackOptions,
  type PlaybackState,
  playbackReducer,
  STEP_INTERVAL_MS,
} from '../../src/client/learn/playback.ts';
import { usePlayback, usePrefersReducedMotion } from '../../src/client/learn/usePlayback.ts';

const MOTION: PlaybackOptions = { total: 3, reducedMotion: false };
const STILL: PlaybackOptions = { total: 3, reducedMotion: true };

function run(
  state: PlaybackState,
  type: PlaybackAction['type'],
  options: PlaybackOptions = MOTION,
): PlaybackState {
  return playbackReducer(state, { type }, options);
}

function stubMatchMedia(matches: boolean): void {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: () => ({ matches, addEventListener: () => {}, removeEventListener: () => {} }),
  });
}

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  delete (window as { matchMedia?: unknown }).matchMedia;
});

describe('initialPlayback', () => {
  it('starts at the first step and plays when motion is allowed', () => {
    expect(initialPlayback(MOTION)).toEqual({ shown: 0, playing: true });
  });

  it('starts complete and paused with reduced motion', () => {
    expect(initialPlayback(STILL)).toEqual({ shown: 3, playing: false });
  });
});

describe('playbackReducer steps', () => {
  it('moves Next and Back one step without changing the playing state', () => {
    const paused: PlaybackState = { shown: 1, playing: false };
    expect(run(paused, 'next')).toEqual({ shown: 2, playing: false });
    expect(run({ shown: 1, playing: true }, 'back')).toEqual({ shown: 0, playing: true });
  });

  it('stops Back at the first step and Next at the last', () => {
    expect(run({ shown: 0, playing: false }, 'back').shown).toBe(0);
    expect(run({ shown: 3, playing: false }, 'next').shown).toBe(3);
  });

  it('stops playing when a manual Next reaches the end', () => {
    expect(run({ shown: 2, playing: true }, 'next')).toEqual({ shown: 3, playing: false });
  });

  it('shows everything and pauses on Skip to end', () => {
    expect(run({ shown: 0, playing: true }, 'skipToEnd')).toEqual({ shown: 3, playing: false });
  });

  it('replays from the first step and keeps playing when motion is allowed', () => {
    expect(run({ shown: 3, playing: false }, 'replay')).toEqual({ shown: 0, playing: true });
  });

  it('replays from the first step and stays paused with reduced motion', () => {
    expect(run({ shown: 3, playing: false }, 'replay', STILL)).toEqual({
      shown: 0,
      playing: false,
    });
  });
});

describe('playbackReducer playing', () => {
  it('pauses and resumes without moving', () => {
    const playing = run({ shown: 1, playing: true }, 'pause');
    expect(playing).toEqual({ shown: 1, playing: false });
    expect(run(playing, 'play')).toEqual({ shown: 1, playing: true });
    expect(run({ shown: 1, playing: true }, 'toggle')).toEqual({ shown: 1, playing: false });
  });

  it('starts again from the first step when Play is pressed at the end', () => {
    expect(run({ shown: 3, playing: false }, 'play')).toEqual({ shown: 0, playing: true });
  });

  it('adds one step per tick while playing, and stops when the build ends', () => {
    const once = run({ shown: 0, playing: true }, 'tick');
    const twice = run(once, 'tick');
    expect([once.shown, twice.shown]).toEqual([1, 2]);
    expect(run(twice, 'tick')).toEqual({ shown: 3, playing: false });
  });

  it('ignores ticks while paused', () => {
    expect(run({ shown: 1, playing: false }, 'tick')).toEqual({ shown: 1, playing: false });
  });

  it('never starts playing with reduced motion', () => {
    const still: PlaybackState = { shown: 3, playing: false };
    expect(run(still, 'play', STILL)).toEqual(still);
    expect(run(still, 'toggle', STILL)).toEqual(still);
  });
});

describe('usePlayback', () => {
  it('advances one step per interval and stops when the build ends', () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => usePlayback({ ...MOTION, ready: true }));

    act(() => vi.advanceTimersByTime(STEP_INTERVAL_MS));
    expect(result.current.shown).toBe(1);

    act(() => vi.advanceTimersByTime(STEP_INTERVAL_MS * 2));
    expect(result.current).toMatchObject({ shown: 3, playing: false });
  });

  it('waits for the canvas before the first step', () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => usePlayback({ ...MOTION, ready: false }));

    act(() => vi.advanceTimersByTime(STEP_INTERVAL_MS * 4));
    expect(result.current.shown).toBe(0);
  });

  it('stops ticking on pause and resumes on play', () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => usePlayback({ ...MOTION, ready: true }));

    act(() => result.current.dispatch({ type: 'pause' }));
    act(() => vi.advanceTimersByTime(STEP_INTERVAL_MS * 3));
    expect(result.current.shown).toBe(0);

    act(() => result.current.dispatch({ type: 'play' }));
    act(() => vi.advanceTimersByTime(STEP_INTERVAL_MS));
    expect(result.current.shown).toBe(1);
  });

  it('starts complete and never auto-advances with reduced motion', () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => usePlayback({ ...STILL, ready: true }));

    act(() => vi.advanceTimersByTime(STEP_INTERVAL_MS * 4));
    expect(result.current).toMatchObject({ shown: 3, playing: false });
  });
});

describe('usePrefersReducedMotion', () => {
  it('reads the reduce-motion preference', () => {
    stubMatchMedia(true);
    const { result } = renderHook(() => usePrefersReducedMotion());
    expect(result.current).toBe(true);
  });

  it('is false when the browser reports no preference', () => {
    stubMatchMedia(false);
    const { result } = renderHook(() => usePrefersReducedMotion());
    expect(result.current).toBe(false);
  });

  it('is false when the browser has no media query support', () => {
    const { result } = renderHook(() => usePrefersReducedMotion());
    expect(result.current).toBe(false);
  });
});
