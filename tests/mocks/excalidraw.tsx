// Test double for the Excalidraw canvas. The real canvas needs a browser layout engine,
// so unit tests replace it and exercise our wrapper code around it.
import type { ReactNode } from 'react';

export interface FakeExcalidrawProps {
  initialData?: unknown;
  onChange?: (elements: readonly object[], appState: object, files: object) => void;
  excalidrawAPI?: (api: object) => void;
  theme?: string;
  children?: ReactNode;
}

/** The most recent props the canvas was rendered with, so tests can simulate edits. */
export const canvasProps: { current: FakeExcalidrawProps | null } = { current: null };

export const Excalidraw = (props: FakeExcalidrawProps) => {
  canvasProps.current = props;
  return <div data-testid="excalidraw-canvas" data-theme={props.theme ?? 'light'} />;
};

export function restore(data: { elements?: unknown; appState?: unknown; files?: unknown } | null): {
  elements: unknown[];
  appState: Record<string, unknown>;
  files: Record<string, unknown>;
} {
  return {
    elements: (data?.elements as unknown[]) ?? [],
    appState: (data?.appState as Record<string, unknown>) ?? {},
    files: (data?.files as Record<string, unknown>) ?? {},
  };
}

export function getNonDeletedElements<T extends { isDeleted?: boolean }>(els: readonly T[]): T[] {
  return els.filter((e) => !e.isDeleted);
}

export async function exportToBlob(): Promise<Blob> {
  return new Blob(['png'], { type: 'image/png' });
}

export async function exportToSvg(): Promise<SVGSVGElement> {
  return document.createElementNS('http://www.w3.org/2000/svg', 'svg');
}

export function serializeAsJSON(elements: unknown, appState: unknown, files: unknown): string {
  return JSON.stringify({ type: 'excalidraw', elements, appState, files });
}

export const CaptureUpdateAction = { IMMEDIATELY: 'IMMEDIATELY' } as const;

export function convertToExcalidrawElements(skeleton: unknown[] | null): unknown[] {
  return (skeleton ?? []).map((el) => ({ ...(el as object), converted: true }));
}

export function newElementWith(el: object, updates: object): object {
  return { ...el, ...updates, version: ((el as { version?: number }).version ?? 0) + 1 };
}
