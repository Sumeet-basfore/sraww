import { CaptureUpdateAction } from '@excalidraw/excalidraw';
import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types';
import { describe, expect, it, vi } from 'vitest';
import { insertFormula } from '../../src/client/math/insert-formula.ts';

vi.mock('@excalidraw/excalidraw', () => import('../mocks/excalidraw.tsx'));

describe('insertFormula', () => {
  it('adds the rendered file before the saved image element', async () => {
    const existing = [{ id: 'existing', type: 'rectangle' }];
    const addFiles = vi.fn();
    const updateScene = vi.fn();
    const api = {
      getAppState: () => ({ width: 800, height: 600, scrollX: 0, scrollY: 0, zoom: { value: 1 } }),
      getSceneElementsIncludingDeleted: () => existing,
      addFiles,
      updateScene,
      scrollToContent: vi.fn(),
    } as unknown as ExcalidrawImperativeAPI;
    const mathApi = { render: vi.fn().mockResolvedValue({ svg: '<svg/>', width: 48, height: 32 }) };

    await insertFormula(api, 'x^2', { fontSize: 20 }, mathApi);

    expect(mathApi.render).toHaveBeenCalledTimes(1);
    expect(mathApi.render).toHaveBeenCalledWith({ latex: 'x^2', fontSize: 20 });
    expect(addFiles).toHaveBeenCalledTimes(1);
    expect(updateScene).toHaveBeenCalledTimes(1);
    expect(addFiles.mock.invocationCallOrder[0]).toBeLessThan(
      updateScene.mock.invocationCallOrder[0] ?? Infinity,
    );
    const file = addFiles.mock.calls[0]?.[0]?.[0];
    const element = updateScene.mock.calls[0]?.[0]?.elements?.[1];
    expect(element).toMatchObject({
      type: 'image',
      status: 'saved',
      scale: [1, 1],
      width: 48,
      height: 32,
      customData: { latex: 'x^2' },
      fileId: file?.id,
    });
    expect(file).toMatchObject({ id: element?.fileId, mimeType: 'image/svg+xml' });
    expect(element?.fileId).toMatch(/^formula-/);
    expect(updateScene.mock.calls[0]?.[0]).toMatchObject({
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    });
  });
});
