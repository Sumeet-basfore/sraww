import type { SaveStatus } from './autosave.ts';

const LABELS: Record<SaveStatus, string> = {
  saved: 'All changes saved',
  unsaved: 'Unsaved changes',
  saving: 'Saving…',
  error: 'Not saved',
};

interface SaveIndicatorProps {
  status: SaveStatus;
  onRetry: () => void;
}

export function SaveIndicator({ status, onRetry }: SaveIndicatorProps) {
  return (
    <div className={`save-indicator ${status}`} role="status" aria-live="polite">
      <span className="dot" aria-hidden="true" />
      <span>{LABELS[status]}</span>
      {status === 'error' && (
        <button type="button" className="button ghost small" onClick={onRetry}>
          Retry
        </button>
      )}
    </div>
  );
}
