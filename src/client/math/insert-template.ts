import { CaptureUpdateAction, convertToExcalidrawElements } from '@excalidraw/excalidraw';
import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types';
import {
  axesSkeleton,
  numberLineSkeleton,
  tableSkeleton,
  type AxesBox,
  type NumberLineBox,
  type TableBox,
} from './templates.ts';

export type TemplateKind = 'axes' | 'number-line' | 'table';

const TEMPLATES = {
  axes: (box: AxesBox) => axesSkeleton({ ...box, step: 40 }),
  'number-line': (box: NumberLineBox) => numberLineSkeleton({ ...box, step: 50 }),
  table: (box: TableBox) => tableSkeleton({ ...box, rows: 3, cols: 3 }),
};

export async function insertTemplate(
  api: ExcalidrawImperativeAPI,
  kind: TemplateKind,
): Promise<void> {
  const app = api.getAppState();
  const box = { x: 80 - app.scrollX, y: 80 - app.scrollY, width: 360, height: 260 };
  const skeleton = TEMPLATES[kind](box);
  const created = convertToExcalidrawElements(skeleton, { regenerateIds: true });
  api.updateScene({
    elements: [...api.getSceneElementsIncludingDeleted(), ...created],
    captureUpdate: CaptureUpdateAction.IMMEDIATELY,
  });
  api.scrollToContent(created, { fitToContent: false });
}
