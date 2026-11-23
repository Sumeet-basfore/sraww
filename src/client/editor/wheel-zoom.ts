// Excalidraw pans with a plain mouse wheel and zooms only with Ctrl held. Scrolling is how most
// people expect to zoom a drawing, so a plain wheel turn over the canvas is re-sent with Ctrl held,
// which Excalidraw then reads as a zoom centred on the pointer.

/** Events this module has created, so it does not convert its own conversions again. */
const converted = new WeakSet<Event>();

/** Returns true when a wheel event happened over the drawing surface itself. */
function isOverCanvas(target: EventTarget | null): target is HTMLCanvasElement {
  return target instanceof HTMLCanvasElement;
}

/**
 * Makes a plain wheel turn zoom the drawing inside `element`. Panels, menus and the library
 * sidebar keep their normal scrolling, and Ctrl, Meta, Alt and Shift keep their meaning.
 * Returns a function that removes the listener.
 */
export function attachWheelZoom(element: HTMLElement): () => void {
  function onWheel(event: WheelEvent): void {
    if (converted.has(event)) return;
    if (event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return;
    if (!isOverCanvas(event.target)) return;

    event.preventDefault();
    event.stopPropagation();
    const zoom = new WheelEvent('wheel', {
      deltaX: event.deltaX,
      deltaY: event.deltaY,
      deltaMode: event.deltaMode,
      clientX: event.clientX,
      clientY: event.clientY,
      ctrlKey: true,
      bubbles: true,
      cancelable: true,
    });
    converted.add(zoom);
    event.target.dispatchEvent(zoom);
  }

  element.addEventListener('wheel', onWheel, { capture: true, passive: false });
  return () => element.removeEventListener('wheel', onWheel, { capture: true });
}
