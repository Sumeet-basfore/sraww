// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_PREFS, loadPrefs, roughnessFor, savePrefs } from '../../src/client/lib/prefs.ts';

afterEach(() => {
  window.localStorage.clear();
  vi.restoreAllMocks();
});

describe('prefs', () => {
  it('returns defaults when nothing is stored', () => {
    expect(loadPrefs()).toEqual(DEFAULT_PREFS);
  });

  it('round-trips saved preferences', () => {
    savePrefs({ theme: 'dark', drawingStyle: 'clean' });
    expect(loadPrefs()).toEqual({ theme: 'dark', drawingStyle: 'clean' });
  });

  it('ignores corrupt stored JSON', () => {
    window.localStorage.setItem('sraww.prefs', '{not json');
    expect(loadPrefs()).toEqual(DEFAULT_PREFS);
  });

  it('falls back to defaults for unknown values', () => {
    window.localStorage.setItem('sraww.prefs', JSON.stringify({ theme: 'neon', drawingStyle: 5 }));
    expect(loadPrefs()).toEqual({ theme: 'light', drawingStyle: 'hand' });
  });

  it('does not throw when storage is blocked', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(loadPrefs()).toEqual(DEFAULT_PREFS);
    expect(() => savePrefs({ theme: 'dark', drawingStyle: 'clean' })).not.toThrow();
  });

  it('maps drawing styles to Excalidraw roughness', () => {
    expect(roughnessFor('hand')).toBe(1);
    expect(roughnessFor('clean')).toBe(0);
  });
});
