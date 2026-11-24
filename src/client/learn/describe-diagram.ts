import type { LessonReply } from '../../shared/learn.ts';
import { isNote } from '../ai/style.ts';

type Diagram = LessonReply['diagram'];

function listing(label: string, items: string[]): string {
  return `${label}: ${items.length > 0 ? `${items.join(', ')}.` : 'none.'}`;
}

/** The diagram in plain words, for people who cannot see the drawing. */
export function describeDiagram(diagram: Diagram): string {
  const labels = new Map(diagram.nodes.map((node) => [node.id, node.label]));
  const boxes = diagram.nodes.filter((node) => !isNote(node)).map((node) => node.label);
  const notes = diagram.nodes.filter(isNote).map((node) => node.label);
  const arrows = diagram.edges.flatMap((edge) => {
    const from = labels.get(edge.from);
    const to = labels.get(edge.to);
    if (from === undefined || to === undefined) return [];
    return [`${from} to ${to}${edge.label ? `, labelled ${edge.label}` : ''}.`];
  });
  const parts = [listing('Boxes', boxes)];
  if (notes.length > 0) parts.push(listing('Notes', notes));
  parts.push(`Arrows: ${arrows.length > 0 ? arrows.join(' ') : 'none.'}`);
  return parts.join(' ');
}
