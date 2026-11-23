import { useEffect, useRef, useState } from 'react';
import { markTourSeen } from './tour-state.ts';
import { TOUR_STEPS } from './tour-steps.ts';

interface TourProps {
  open: boolean;
  onClose: () => void;
}

/**
 * A first-visit walkthrough of the whole site. It is a modal dialog: Escape, Skip or Finish close it,
 * and any of those marks it as seen so it does not open again on its own.
 */
export function Tour({ open, onClose }: TourProps) {
  const [index, setIndex] = useState(0);
  const primary = useRef<HTMLButtonElement>(null);
  const step = TOUR_STEPS[index];
  const isLast = index === TOUR_STEPS.length - 1;

  // Start from the first step each time the tour is opened.
  useEffect(() => {
    if (open) setIndex(0);
  }, [open]);

  useEffect(() => {
    if (open) primary.current?.focus();
  }, [open, index]);

  useEffect(() => {
    if (!open) return undefined;
    function onKey(event: KeyboardEvent): void {
      if (event.key !== 'Escape') return;
      markTourSeen();
      onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open || !step) return null;

  function close(): void {
    markTourSeen();
    onClose();
  }

  function next(): void {
    if (isLast) close();
    else setIndex((i) => i + 1);
  }

  return (
    <div className="tour-backdrop">
      <div
        className="tour-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="tour-title"
        aria-describedby="tour-body"
      >
        <p className="tour-count">
          Step {index + 1} of {TOUR_STEPS.length}
        </p>
        <h2 id="tour-title">{step.title}</h2>
        <p id="tour-body">{step.body}</p>
        {step.where && (
          <p className="tour-where">
            <span>Where: </span>
            {step.where}
          </p>
        )}
        <div className="tour-actions">
          <button type="button" className="button ghost" onClick={close}>
            Skip tour
          </button>
          <span className="tour-spacer" />
          <button
            type="button"
            className="button"
            disabled={index === 0}
            onClick={() => setIndex((i) => Math.max(0, i - 1))}
          >
            Back
          </button>
          <button ref={primary} type="button" className="button primary" onClick={next}>
            {isLast ? 'Finish' : 'Next'}
          </button>
        </div>
      </div>
    </div>
  );
}
