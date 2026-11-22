export type Theme = 'light' | 'dark';
export type DrawingStyle = 'hand' | 'clean';

export interface Prefs {
  theme: Theme;
  drawingStyle: DrawingStyle;
}

export const DEFAULT_PREFS: Prefs = { theme: 'light', drawingStyle: 'hand' };

const STORAGE_KEY = 'sraww.prefs';

/** Per-browser UI preferences. Storage can be blocked or hold junk, so every failure falls back to defaults. */
export function loadPrefs(): Prefs {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_PREFS;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return DEFAULT_PREFS;
    const theme = 'theme' in parsed && parsed.theme === 'dark' ? 'dark' : 'light';
    const drawingStyle =
      'drawingStyle' in parsed && parsed.drawingStyle === 'clean' ? 'clean' : 'hand';
    return { theme, drawingStyle };
  } catch {
    return DEFAULT_PREFS;
  }
}

export function savePrefs(prefs: Prefs): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // Private windows can refuse storage. The preference then lasts for this page only.
  }
}

/** Excalidraw's roughness value for new elements: 1 is hand-drawn, 0 is clean lines. */
export function roughnessFor(style: DrawingStyle): number {
  return style === 'clean' ? 0 : 1;
}
