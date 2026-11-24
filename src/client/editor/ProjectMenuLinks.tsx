import { MainMenu } from '@excalidraw/excalidraw';
import { PROJECT_LINKS } from '../lib/project-links.ts';

/** sraww's links, shown after the default items. Render it inside a MainMenu. */
export function ProjectMenuLinks() {
  return (
    <>
      <MainMenu.Separator />
      {PROJECT_LINKS.map((link) => (
        <MainMenu.Item
          key={link.href}
          onSelect={() => window.open(link.href, '_blank', 'noopener,noreferrer')}
        >
          {link.label}
        </MainMenu.Item>
      ))}
    </>
  );
}
