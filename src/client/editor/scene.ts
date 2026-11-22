import type { ExcalidrawScene } from '../../shared/diagram.ts';

/** Cheap fingerprint: changes whenever any element changes, ignores pan and zoom. */
export function sceneFingerprint(elements: readonly Record<string, unknown>[]): string {
  return elements
    .map((e) => `${String(e.id)}:${String(e.version ?? 0)}:${String(e.versionNonce ?? 0)}`)
    .join('|');
}

/** Only these app-state keys are saved; the rest is per-session UI state. */
export function toSavedScene(
  elements: readonly object[],
  appState: { viewBackgroundColor?: unknown; gridSize?: unknown },
  files: Record<string, unknown>,
): ExcalidrawScene {
  return {
    type: 'excalidraw',
    version: 2,
    source: 'sraww',
    elements: elements as ExcalidrawScene['elements'],
    appState: {
      viewBackgroundColor: appState.viewBackgroundColor,
      gridSize: appState.gridSize,
    },
    files,
  };
}
