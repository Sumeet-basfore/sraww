import { useEffect, useRef } from 'react';
import type { DiagramGraph } from '../../../shared/ai-schemas.ts';

export interface Entry {
  id: number;
  role: 'user' | 'assistant' | 'system';
  text: string;
  notes?: string[];
  /** A diagram the assistant proposed, waiting for the user to add or replace. */
  graph?: DiagramGraph;
  graphState?: 'pending' | 'added' | 'replaced';
}

interface MessageLogProps {
  entries: Entry[];
  busy: boolean;
  onAdd: (id: number, graph: DiagramGraph) => void;
  onReplace: (id: number, graph: DiagramGraph) => void;
}

const STATE_TEXT: Record<'added' | 'replaced', string> = {
  added: 'Added to the drawing.',
  replaced: 'Replaced the drawing with this diagram.',
};

/** The conversation. New messages scroll into view; proposed diagrams carry their own actions. */
export function MessageLog({ entries, busy, onAdd, onReplace }: MessageLogProps) {
  const end = useRef<HTMLLIElement>(null);

  useEffect(() => {
    end.current?.scrollIntoView?.({ block: 'end' });
  }, [entries.length]);

  if (entries.length === 0) {
    return (
      <ol className="assistant-log" aria-live="polite">
        <li className="assistant-empty muted">
          Ask for a change to this drawing, or switch to “New diagram” to draw one from a
          description. Select shapes and press “Explain selection” to understand them.
        </li>
      </ol>
    );
  }

  return (
    <ol className="assistant-log" aria-live="polite">
      {entries.map((entry) => (
        <li key={entry.id} className={`assistant-msg ${entry.role}`}>
          <p>{entry.text}</p>
          {entry.notes?.map((note) => (
            <p key={note} className="assistant-note">
              {note}
            </p>
          ))}
          {entry.graph && (
            <div className="assistant-proposal">
              {entry.graphState === 'pending' ? (
                <div className="form-actions">
                  <button
                    type="button"
                    className="button primary small"
                    disabled={busy}
                    onClick={() => onAdd(entry.id, entry.graph!)}
                  >
                    Add to drawing
                  </button>
                  <button
                    type="button"
                    className="button small"
                    disabled={busy}
                    onClick={() => onReplace(entry.id, entry.graph!)}
                  >
                    Replace drawing
                  </button>
                </div>
              ) : (
                <p className="muted small">{STATE_TEXT[entry.graphState ?? 'added']}</p>
              )}
            </div>
          )}
        </li>
      ))}
      <li ref={end} aria-hidden="true" />
    </ol>
  );
}
