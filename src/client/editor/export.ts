import {
  exportToBlob,
  exportToSvg,
  getNonDeletedElements,
  serializeAsJSON,
} from '@excalidraw/excalidraw';

export type ExportFormat = 'png' | 'svg' | 'excalidraw';

export interface SceneSnapshot {
  elements: readonly object[];
  appState: object;
  files: object;
}

/** Turns a diagram name into a safe file name, keeping letters, digits, spaces and dashes. */
export function exportFileName(name: string, format: ExportFormat): string {
  const base =
    name
      .replace(/[^a-zA-Z0-9 _-]+/g, '-')
      .replace(/\s+/g, ' ')
      .trim() || 'diagram';
  const extension = format === 'excalidraw' ? 'excalidraw' : format;
  return `${base}.${extension}`;
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// Excalidraw's exporters expect non-deleted elements and an AppState-shaped object.
type ExportableScene = Parameters<typeof exportToBlob>[0];

function exportable(snapshot: SceneSnapshot): ExportableScene {
  return {
    elements: getNonDeletedElements(snapshot.elements as never) as ExportableScene['elements'],
    appState: snapshot.appState as ExportableScene['appState'],
    files: snapshot.files as ExportableScene['files'],
  };
}

async function toBlob(format: ExportFormat, snapshot: SceneSnapshot): Promise<Blob> {
  if (format === 'png') {
    return exportToBlob({ ...exportable(snapshot), mimeType: 'image/png' });
  }
  if (format === 'svg') {
    const svg = await exportToSvg(exportable(snapshot));
    return new Blob([new XMLSerializer().serializeToString(svg)], { type: 'image/svg+xml' });
  }
  const json = serializeAsJSON(
    snapshot.elements as never,
    snapshot.appState as never,
    snapshot.files as never,
    'local',
  );
  return new Blob([json], { type: 'application/json' });
}

/** Exports the current drawing as PNG, SVG, or the native .excalidraw JSON, and downloads it. */
export async function exportScene(
  format: ExportFormat,
  snapshot: SceneSnapshot,
  name: string,
): Promise<void> {
  const blob = await toBlob(format, snapshot);
  downloadBlob(blob, exportFileName(name, format));
}
