/** Links shown in the drawing editor's main menu. These are sraww's own links, not Excalidraw's. */
export interface ProjectLink {
  label: string;
  href: string;
}

export const PROJECT_LINKS: readonly ProjectLink[] = [
  { label: 'sraww on GitHub', href: 'https://github.com/Sumeet-basfore/sraww' },
  { label: 'Report an issue', href: 'https://github.com/Sumeet-basfore/sraww/issues' },
];
