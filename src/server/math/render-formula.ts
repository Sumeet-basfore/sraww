import MathJax from 'mathjax';
import { DiagramError } from '../storage/diagram-store.ts';

const MAX_LATEX_LENGTH = 500;
const MIN_FONT_SIZE = 12;
const MAX_FONT_SIZE = 120;
const UNITS_PER_EM = 1000;
const MAX_DIMENSION = 2000;

let initPromise: Promise<unknown> | undefined;

function initializeMathJax(): Promise<unknown> {
  initPromise ??= MathJax.init({ loader: { load: ['input/tex', 'output/svg'] } });
  return initPromise;
}

export function extractSvg(markup: string): string {
  const start = markup.indexOf('<svg');
  const end = markup.indexOf('</svg>', start);
  if (start < 0 || end < 0) {
    throw new Error('MathJax did not return an SVG element.');
  }
  return (
    markup
      .slice(start, end + '</svg>'.length)
      // Keep the SVG namespace on the root: an image loaded from a data URL will not render without it.
      // Only the xlink declaration is dropped, because xlink:href is rewritten to href below.
      .replace(/\s+xmlns:xlink="[^"]*"/g, '')
      .replace(/\bxlink:href=/gi, 'href=')
      .replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi, '')
      .replace(/<foreignObject\b[^>]*>[\s\S]*?<\/foreignObject\s*>/gi, '')
      .replace(/\s+on[a-z]+\s*=\s*(?:"[^"]*"|'[^']*')/gi, '')
      .replace(/\s+data-latex\s*=\s*(?:"[^"]*"|'[^']*')/gi, '')
      .replace(/\s+(?:xlink:)?href\s*=\s*(?:"(?!#)[^"]*"|'(?!#)[^']*')/gi, '')
      .replace(/\s+style\s*=\s*("[^"]*"|'[^']*')/gi, (attribute) => {
        return /url\s*\(|expression|javascript:|@import|<|\\/i.test(attribute) ? '' : attribute;
      })
  );
}

export async function renderFormula(
  latex: string,
  fontSize = 20,
): Promise<{ svg: string; width: number; height: number }> {
  if (latex.length === 0) {
    throw new DiagramError('INVALID_CONTENT', 'Formula cannot be empty.');
  }
  if (latex.length > MAX_LATEX_LENGTH) {
    throw new DiagramError(
      'INVALID_CONTENT',
      `Formula must be ${MAX_LATEX_LENGTH} characters or fewer.`,
    );
  }

  await initializeMathJax();
  const node = await MathJax.tex2svgPromise(latex, { display: true });
  const markup = MathJax.startup.adaptor.outerHTML(node);
  if (/data-mjx-error|mjx-merror/i.test(markup)) {
    throw new DiagramError('INVALID_CONTENT', 'That formula has an error.');
  }

  const svg = extractSvg(markup);
  const viewBox = svg.match(/\bviewBox="[-\d.]+\s+[-\d.]+\s+([\d.]+)\s+([\d.]+)"/i);
  if (!viewBox) {
    throw new Error('MathJax returned an SVG without a valid viewBox.');
  }

  const boundedFontSize = Math.min(MAX_FONT_SIZE, Math.max(MIN_FONT_SIZE, fontSize));
  const rawWidth = (Number(viewBox[1]) / UNITS_PER_EM) * boundedFontSize;
  const rawHeight = (Number(viewBox[2]) / UNITS_PER_EM) * boundedFontSize;
  const dimensionScale = Math.min(1, MAX_DIMENSION / Math.max(rawWidth, rawHeight));
  const width = Math.max(1, Math.round(rawWidth * dimensionScale));
  const height = Math.max(1, Math.round(rawHeight * dimensionScale));

  return { svg, width, height };
}
