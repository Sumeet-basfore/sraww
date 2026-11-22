export type Route =
  { view: 'list' } | { view: 'editor'; name: string } | { view: 'architecture'; name: string };

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

/** Parses the URL hash so that reloading the page reopens the same diagram or architecture map. */
export function parseRoute(hash: string): Route {
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
