import { LOCKUP_VIEWBOX, WORDMARK_PATH } from './logo-paths.ts';

interface LogoProps {
  /** 'lockup' shows the symbol with the wordmark; 'symbol' shows the mark alone. */
  variant?: 'lockup' | 'symbol';
  className?: string;
}

/**
 * The sraww mark (see brand/guidelines.md). Colours come from the app's theme tokens through
 * CSS classes, so the mark follows light and dark mode. The wordmark uses currentColor.
 */
function Mark() {
  return (
    <>
      <path className="brand-frame" d="M44 16H16V80H80V52" strokeWidth="8" strokeLinejoin="miter" />
      <circle className="brand-point" cx="56" cy="56" r="9" />
    </>
  );
}

export function Logo({ variant = 'lockup', className }: LogoProps) {
  if (variant === 'symbol') {
    return (
      <svg
        className={className}
        viewBox="-8 -8 112 112"
        role="img"
        aria-label="sraww"
        focusable="false"
      >
        <Mark />
      </svg>
    );
  }
  return (
    <svg
      className={className}
      viewBox={LOCKUP_VIEWBOX}
      role="img"
      aria-label="sraww"
      focusable="false"
    >
      <Mark />
      <path className="brand-wordmark" d={WORDMARK_PATH} />
    </svg>
  );
}
