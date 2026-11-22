import { convertToExcalidrawElements } from '@excalidraw/excalidraw';
import type { ExcalidrawScene } from '../../shared/diagram.ts';
import type { ArchLayout, ArchModel } from '../../shared/arch-model.ts';
import { toSavedScene } from '../editor/scene.ts';
import { renderArchitecture } from './render.ts';

/**
 * Excalidraw elements for the architecture. Ids are kept (regenerateIds false) so the canvas can be
 * matched back to the model: node:<id>, group:<id>, edge:<from>><to>.
 */
export async function architectureElements(
  model: ArchModel,
  layout: ArchLayout | null,
): Promise<ReturnType<typeof convertToExcalidrawElements>> {
  const { skeleton } = await renderArchitecture(model, layout);
  return convertToExcalidrawElements(skeleton, { regenerateIds: false });
}

export function architectureScene(
  elements: ReturnType<typeof convertToExcalidrawElements>,
): ExcalidrawScene {
  return toSavedScene(elements, { viewBackgroundColor: '#ffffff', gridSize: null }, {});
}
