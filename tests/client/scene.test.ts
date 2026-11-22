import { describe, expect, it } from 'vitest';
import { sceneFingerprint, toSavedScene } from '../../src/client/editor/scene.ts';

describe('sceneFingerprint', () => {
  it('changes when an element version changes', () => {
    const a = sceneFingerprint([{ id: 'x', version: 1, versionNonce: 5 }]);
    const b = sceneFingerprint([{ id: 'x', version: 2, versionNonce: 9 }]);
    expect(a).not.toBe(b);
  });

  it('is equal for the same elements', () => {
    const els = [{ id: 'x', version: 1, versionNonce: 5 }];
    expect(sceneFingerprint(els)).toBe(sceneFingerprint([...els]));
  });
});

describe('toSavedScene', () => {
  it('keeps only the persisted app-state keys', () => {
    const appState = { viewBackgroundColor: '#fff', gridSize: null, zoom: { value: 2 } };
    const scene = toSavedScene([{ id: 'x', type: 'rectangle' }], appState, {});
    expect(scene.appState).toEqual({ viewBackgroundColor: '#fff', gridSize: null });
    expect(scene.type).toBe('excalidraw');
    expect(scene.elements).toEqual([{ id: 'x', type: 'rectangle' }]);
  });
});
