// Excalidraw loads its fonts from this path (copied to public/fonts by scripts/copy-excalidraw-fonts.mjs).
// It is set in a module rather than an inline script, because the Content Security Policy blocks inline scripts.
(window as Window & { EXCALIDRAW_ASSET_PATH?: string }).EXCALIDRAW_ASSET_PATH = '/';
