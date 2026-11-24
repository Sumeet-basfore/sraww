import { LEARN_ID_PATTERN } from '../../shared/learn.ts';

export type Route =
  | { view: 'list' }
  | { view: 'learn' }
  | { view: 'course'; id: string }
  | { view: 'lesson'; id: string }
  | { view: 'maps' }
  | { view: 'ai' }
  | { view: 'editor'; name: string }
  | { view: 'architecture'; name: string };

const LEARN_HASH = '#/learn';
const LESSON_HASH = /^#\/learn\/(.*)$/;
const COURSE_HASH = /^#\/course\/(.*)$/;
const MAPS_HASH = '#/architecture';
const AI_HASH = '#/ai';
const EDITOR_HASH = /^#\/diagram\/(.+)$/;
const ARCH_HASH = /^#\/arch\/(.+)$/;

function decodeName(encoded: string | undefined): string | null {
  if (!encoded) return null;
  try {
    return decodeURIComponent(encoded);
  } catch {
    return null;
  }
}

/** Parses the URL hash so that reloading the page reopens the same page, drawing or architecture map. */
export function parseRoute(hash: string): Route {
  if (hash === LEARN_HASH) return { view: 'learn' };
  const lesson = LESSON_HASH.exec(hash);
  if (lesson) {
    const id = lesson[1] ?? '';
    return LEARN_ID_PATTERN.test(id) ? { view: 'lesson', id } : { view: 'learn' };
  }
  const course = COURSE_HASH.exec(hash);
  if (course) {
    const id = course[1] ?? '';
    return LEARN_ID_PATTERN.test(id) ? { view: 'course', id } : { view: 'learn' };
  }
  if (hash === MAPS_HASH) return { view: 'maps' };
  if (hash === AI_HASH) return { view: 'ai' };
  const arch = ARCH_HASH.exec(hash);
  if (arch) {
    const name = decodeName(arch[1]);
    return name ? { view: 'architecture', name } : { view: 'list' };
  }
  const editor = EDITOR_HASH.exec(hash);
  const name = decodeName(editor?.[1]);
  return name ? { view: 'editor', name } : { view: 'list' };
}

export function editorHash(name: string): string {
  return `#/diagram/${encodeURIComponent(name)}`;
}

export function architectureHash(name: string): string {
  return `#/arch/${encodeURIComponent(name)}`;
}

export function mapsHash(): string {
  return MAPS_HASH;
}

export function learnHash(): string {
  return LEARN_HASH;
}

export function lessonHash(id: string): string {
  return `${LEARN_HASH}/${encodeURIComponent(id)}`;
}

export function courseHash(id: string): string {
  return `#/course/${encodeURIComponent(id)}`;
}

export function aiSettingsHash(): string {
  return AI_HASH;
}
