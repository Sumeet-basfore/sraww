import { CaptureUpdateAction } from '@excalidraw/excalidraw';
import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types';
import { describe, expect, it, vi } from 'vitest';
import { insertTemplate } from '../../src/client/math/insert-template.ts';

vi.mock('@excalidraw/excalidraw', () => import('../mocks/excalidraw.tsx'));

describe('insertTemplate', () => {
  it('adds the template inside the viewport without replacing existing elements', async () => {
    const existing = [{ id: 'existing', type: 'rectangle' }];
    const updateScene = vi.fn();
    const scrollToContent = vi.fn();
    const api = {
      getAppState: () => ({ width: 800, height: 600, scrollX: 0, scrollY: 0, zoom: { value: 1 } }),
      getSceneElementsIncludingDeleted: () => existing,
      updateScene,
      scrollToContent,
    } as unknown as ExcalidrawImperativeAPI;

    await insertTemplate(api, 'axes');

    expect(updateScene).toHaveBeenCalledTimes(1);
    const update = updateScene.mock.calls[0]?.[0];
    expect(update).toMatchObject({ captureUpdate: CaptureUpdateAction.IMMEDIATELY });
    expect(update?.elements).toEqual(expect.arrayContaining(existing));
    expect(update?.elements.length).toBeGreaterThan(existing.length + 2);
    const created = update?.elements.slice(existing.length) as { x: number; y: number }[] | undefined;
    expect(created?.every((element) =>
      element.x >= 0 && element.x <= 800 && element.y >= 0 && element.y <= 600,
    )).toBe(true);
    expect(scrollToContent).toHaveBeenCalledWith(created, {
      fitToContent: false,
    });
  });
});
