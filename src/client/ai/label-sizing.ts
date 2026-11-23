import type { GraphNode } from '../../shared/ai-schemas.ts';

export const SHAPE_FONT_SIZE = 18;
const MIN_WIDTH = 200;
const MAX_LINE_WIDTH = 200;
const HORIZONTAL_PADDING = 36;
const LINE_HEIGHT = 27;

/**
 * Canvas-independent estimate for Excalidraw's Virgil shape font (fontFamily 5): average glyph
 * advance is approximated as 0.58 em. Keeping this deterministic avoids DOM/font loading variance.
 */
export function measureLabel(text: string, fontSize = SHAPE_FONT_SIZE): number {
  return [...text].length * fontSize * 0.58;
}

export function sizeLabel(
  text: string,
  shape: GraphNode['shape'] = 'rectangle',
  fontSize = SHAPE_FONT_SIZE,
): { width: number; height: number; lines: string[] } {
  const usableRatio = shape === 'diamond' ? 0.56 : shape === 'ellipse' ? 0.74 : 1;
  const words = text.split(/\s+/).filter(Boolean);
  const longestWord = Math.max(0, ...words.map((word) => measureLabel(word, fontSize)));
  const totalWidth = measureLabel(text, fontSize);
  const lineLimit =
    totalWidth <= MAX_LINE_WIDTH ? totalWidth : Math.max(MAX_LINE_WIDTH, longestWord);
  const width = Math.max(MIN_WIDTH, Math.ceil((lineLimit + HORIZONTAL_PADDING) / usableRatio));
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (line && measureLabel(candidate, fontSize) > lineLimit) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  }
  if (line) lines.push(line);
  return { width, height: Math.max(72, 30 + Math.max(1, lines.length) * LINE_HEIGHT), lines };
}
