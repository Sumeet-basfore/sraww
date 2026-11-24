/**
 * Excalidraw options shared by the editor and the lesson canvas. AI stays off in both.
 * Load scene is off: loading from Excalidraw's own menu would replace this drawing, and autosave
 * would then write the replacement here. Importing goes through the app instead.
 */
export const DRAWING_UI_OPTIONS = { canvasActions: { loadScene: false } } as const;
