/** Time between automatic steps while the build-up plays. */
export const STEP_INTERVAL_MS = 1200;

export interface PlaybackState {
  /** How many build steps are on the canvas, from 0 to the total. */
  shown: number;
  playing: boolean;
}

export interface PlaybackOptions {
  total: number;
  /** With reduced motion there is no build-up: the diagram starts complete and nothing auto-plays. */
  reducedMotion: boolean;
}

export type PlaybackActionType =
  'play' | 'pause' | 'toggle' | 'next' | 'back' | 'skipToEnd' | 'replay' | 'tick';

export interface PlaybackAction {
  type: PlaybackActionType;
}

export function initialPlayback({ total, reducedMotion }: PlaybackOptions): PlaybackState {
  if (reducedMotion) return { shown: total, playing: false };
  return { shown: 0, playing: total > 0 };
}

export function playbackReducer(
  state: PlaybackState,
  action: PlaybackAction,
  options: PlaybackOptions,
): PlaybackState {
  const { total, reducedMotion } = options;
  switch (action.type) {
    case 'play':
      return play(state, options);
    case 'pause':
      return { ...state, playing: false };
    case 'toggle':
      return state.playing ? { ...state, playing: false } : play(state, options);
    case 'next':
      return stepForward(state, total);
    case 'tick':
      return state.playing ? stepForward(state, total) : state;
    case 'back':
      return { ...state, shown: Math.max(0, state.shown - 1) };
    case 'skipToEnd':
      return { shown: total, playing: false };
    case 'replay':
      return { shown: 0, playing: !reducedMotion && total > 0 };
  }
}

function play(state: PlaybackState, { total, reducedMotion }: PlaybackOptions): PlaybackState {
  if (reducedMotion) return state;
  if (state.shown >= total) return { shown: 0, playing: total > 0 };
  return { ...state, playing: true };
}

/** One step forward. Playback stops on reaching the end; otherwise it keeps its playing state. */
function stepForward(state: PlaybackState, total: number): PlaybackState {
  const shown = Math.min(total, state.shown + 1);
  return { shown, playing: state.playing && shown < total };
}
