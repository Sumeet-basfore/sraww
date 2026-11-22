import { CHAT_LIMITS, type SceneSummary } from '../../shared/chat-schemas.ts';

/** The parts of an Excalidraw element this module reads. Matches Excalidraw's element fields. */
export interface SummarizableElement {
  id: string;
  type: string;
  isDeleted?: boolean;
  containerId?: string | null;
  text?: string;
  startBinding?: { elementId: string } | null;
  endBinding?: { elementId: string } | null;
}

const SHAPE_KINDS = new Set(['rectangle', 'ellipse', 'diamond']);

/**
 * A compact description of the diagram for the model: shapes with their labels, and arrows with
 * the shapes they are glued to. Only live (not deleted) elements are included.
 */
export function summarizeScene(
  elements: readonly SummarizableElement[],
  selectedIds?: ReadonlySet<string>,
): SceneSummary {
  const live = elements.filter((el) => !el.isDeleted && (!selectedIds || selectedIds.has(el.id)));
  const labelOf = new Map<string, string>();
  for (const el of elements) {
    if (el.type === 'text' && el.containerId && !el.isDeleted && !labelOf.has(el.containerId)) {
      labelOf.set(el.containerId, el.text ?? '');
    }
  }

  const shapes = live
    .filter((el) => SHAPE_KINDS.has(el.type))
    .slice(0, CHAT_LIMITS.maxShapes)
    .map((el) => ({
      id: el.id,
      kind: el.type as 'rectangle' | 'ellipse' | 'diamond',
      label: labelOf.get(el.id) ?? '',
    }));

  const arrows = live
    .filter((el) => el.type === 'arrow')
    .slice(0, CHAT_LIMITS.maxArrows)
    .map((el) => ({
      id: el.id,
      from: el.startBinding?.elementId ?? null,
      to: el.endBinding?.elementId ?? null,
      label: labelOf.get(el.id) ?? null,
    }));

  return { shapes, arrows };
}
