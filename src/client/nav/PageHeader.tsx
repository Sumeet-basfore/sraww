import type { ReactNode } from 'react';
import { Logo } from '../brand/Logo.tsx';
import { aiSettingsHash, learnHash, mapsHash } from '../lib/route.ts';
import './nav.css';

export type MainTab = 'drawings' | 'learn' | 'architecture' | 'ai';

/** The four top-level tabs, in the order a new person meets them. The hashes come from route.ts. */
export const MAIN_TABS: readonly { id: MainTab; label: string; href: string }[] = [
  { id: 'drawings', label: 'Drawings', href: '#/' },
  { id: 'learn', label: 'Learn', href: learnHash() },
  { id: 'architecture', label: 'Architecture', href: mapsHash() },
  { id: 'ai', label: 'AI tools', href: aiSettingsHash() },
];

interface PageHeaderProps {
  current: MainTab;
  /** Actions shown at the right: the tour button, and on the drawings page the AI status. */
  children?: ReactNode;
}

/** The header shared by every top-level page. The current tab is marked with aria-current. */
export function PageHeader({ current, children }: PageHeaderProps) {
  return (
    <header className="masthead page-header">
      <Logo className="brand-lockup" />
      <nav className="main-tabs" aria-label="Main">
        {MAIN_TABS.map((tab) => (
          <a
            key={tab.id}
            href={tab.href}
            className="main-tab"
            aria-current={tab.id === current ? 'page' : undefined}
          >
            {tab.label}
          </a>
        ))}
      </nav>
      <div className="masthead-links">{children}</div>
    </header>
  );
}
