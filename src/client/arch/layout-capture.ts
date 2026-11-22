import type { ArchLayout } from '../../shared/arch-model.ts';
import { elementIds } from './render.ts';

interface PositionedElement {
  id: string;
  x: number;
  y: number;
  isDeleted?: boolean;
}

/** Reads where each architecture node sits on the canvas, keyed by model id. */
export function capturePositions(elements: readonly PositionedElement[]): ArchLayout['positions'] {
  const positions: ArchLayout['positions'] = {};
  const prefix = elementIds.node('');
  for (const el of elements) {
    if (el.isDeleted || !el.id.startsWith(prefix)) continue;
    positions[el.id.slice(prefix.length)] = { x: el.x, y: el.y };
  }
  return positions;
}
