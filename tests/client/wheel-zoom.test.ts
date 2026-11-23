// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { attachWheelZoom } from '../../src/client/editor/wheel-zoom.ts';

let detach: (() => void) | null = null;

afterEach(() => {
  detach?.();
  detach = null;
  document.body.innerHTML = '';
});

function setup(): { canvas: HTMLCanvasElement; panel: HTMLDivElement; seen: WheelEvent[] } {
  const host = document.createElement('div');
  const canvas = document.createElement('canvas');
  const panel = document.createElement('div');
  host.append(canvas, panel);
  document.body.append(host);
  // Excalidraw listens on its own container, so the converted event must reach it.
  const seen: WheelEvent[] = [];
  host.addEventListener('wheel', (event) => seen.push(event));
  detach = attachWheelZoom(host);
  return { canvas, panel, seen };
}

describe('attachWheelZoom', () => {
  it('turns a plain wheel turn over the canvas into a Ctrl-wheel turn', () => {
    const { canvas, seen } = setup();
    canvas.dispatchEvent(
      new WheelEvent('wheel', { deltaY: -120, bubbles: true, cancelable: true }),
    );
    expect(seen).toHaveLength(1);
    expect(seen[0]).toMatchObject({ ctrlKey: true, deltaY: -120 });
  });

  it('leaves wheel turns over menus and panels alone', () => {
    const { panel, seen } = setup();
    panel.dispatchEvent(new WheelEvent('wheel', { deltaY: 120, bubbles: true, cancelable: true }));
    expect(seen).toHaveLength(1);
    expect(seen[0]?.ctrlKey).toBe(false);
  });

  it('keeps Ctrl, Shift and Alt wheel turns as they are', () => {
    const { canvas, seen } = setup();
    canvas.dispatchEvent(new WheelEvent('wheel', { deltaY: 40, ctrlKey: true, bubbles: true }));
    canvas.dispatchEvent(new WheelEvent('wheel', { deltaY: 40, shiftKey: true, bubbles: true }));
    expect(seen.map((e) => e.shiftKey)).toEqual([false, true]);
    expect(seen).toHaveLength(2);
  });

  it('removes its listener when detached', () => {
    const { canvas, seen } = setup();
    detach?.();
    detach = null;
    const spy = vi.fn();
    canvas.addEventListener('wheel', spy);
    canvas.dispatchEvent(new WheelEvent('wheel', { deltaY: 40, bubbles: true }));
    expect(spy).toHaveBeenCalledTimes(1);
    expect(seen[0]?.ctrlKey).toBe(false);
  });
});
