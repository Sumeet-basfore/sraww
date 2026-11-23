import { CaptureUpdateAction, convertToExcalidrawElements } from '@excalidraw/excalidraw';
import type { FileId } from '@excalidraw/excalidraw/element/types';
import type {
  BinaryFileData,
  DataURL,
  ExcalidrawImperativeAPI,
} from '@excalidraw/excalidraw/types';
import { mathApi as clientMathApi } from '../lib/api.ts';

export interface MathRenderResult {
  svg: string;
  width: number;
  height: number;
}

export interface MathApi {
  render(input: { latex: string; fontSize: number }): Promise<MathRenderResult>;
}

export interface InsertFormulaOptions {
  fontSize?: number;
}

function toBase64(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = '';
  for (let index = 0; index < bytes.length; index += 1) {
    binary += String.fromCharCode(bytes[index] ?? 0);
  }
  return btoa(binary);
}

export async function insertFormula(
  api: ExcalidrawImperativeAPI,
  latex: string,
  options: InsertFormulaOptions = {},
  mathApi: MathApi = clientMathApi,
): Promise<void> {
  const rendered = await mathApi.render({ latex, fontSize: options.fontSize ?? 20 });
  const fileId = `formula-${crypto.randomUUID()}`;
  const dataURL = `data:image/svg+xml;base64,${toBase64(rendered.svg)}`;
  const appState = api.getAppState();
  const element = {
    type: 'image' as const,
    x: 80 - appState.scrollX,
    y: 80 - appState.scrollY,
    width: rendered.width,
    height: rendered.height,
    fileId: fileId as FileId,
    status: 'saved' as const,
    scale: [1, 1] as [number, number],
    customData: { latex },
  };
  const created = convertToExcalidrawElements([element], { regenerateIds: false });

  // Excalidraw reads image data from its file store during scene updates.
  const file: BinaryFileData = {
    id: fileId as FileId,
    dataURL: dataURL as DataURL,
    mimeType: 'image/svg+xml',
    created: Date.now(),
  };
  api.addFiles([file]);
  api.updateScene({
    elements: [...api.getSceneElementsIncludingDeleted(), ...created],
    captureUpdate: CaptureUpdateAction.IMMEDIATELY,
  });
  api.scrollToContent(created, { fitToContent: false });
}
