export type Route = { view: 'list' } | { view: 'editor'; name: string };

const EDITOR_HASH = /^#\/diagram\/(.+)$/;

/** Parses the URL hash so that reloading the page reopens the same diagram. */
export function parseRoute(hash: string): Route {
  const match = EDITOR_HASH.exec(hash);
  if (!match?.[1]) return { view: 'list' };
  try {
    return { view: 'editor', name: decodeURIComponent(match[1]) };
  } catch {
    return { view: 'list' };
  }
}

export function editorHash(name: string): string {
  return `#/diagram/${encodeURIComponent(name)}`;
}
