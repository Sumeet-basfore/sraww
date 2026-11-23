import { useEffect, useState, type FormEvent } from 'react';
import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types';
import { errorMessage } from '../lib/errors.ts';
import { insertFormula, type MathApi } from './insert-formula.ts';

interface FormulaDialogProps {
  api: ExcalidrawImperativeAPI;
  onClose: () => void;
  mathApi?: MathApi;
}

const SIZES = [
  { label: 'Small', value: 16 },
  { label: 'Normal', value: 20 },
  { label: 'Large', value: 28 },
] as const;

function stripMathDelimiters(value: string): string {
  const trimmed = value.trim();
  return trimmed.startsWith('$') && trimmed.endsWith('$') && trimmed.length >= 2
    ? trimmed.slice(1, -1).trim()
    : trimmed;
}

export function FormulaDialog({ api, onClose, mathApi }: FormulaDialogProps) {
  const [latex, setLatex] = useState('');
  const [fontSize, setFontSize] = useState(20);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent): void {
      if (event.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const formula = stripMathDelimiters(latex);
    if (!formula || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      await insertFormula(api, formula, { fontSize }, mathApi);
      onClose();
    } catch (err) {
      setError(errorMessage(err));
      setSubmitting(false);
    }
  }

  return (
    <div className="tour-overlay formula-overlay">
      <section
        className="tour-dialog formula-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="formula-title"
      >
        <h2 id="formula-title">Insert formula</h2>
        <form onSubmit={(event) => void submit(event)}>
          <label className="formula-label" htmlFor="formula-latex">
            LaTeX
          </label>
          <input
            autoFocus
            id="formula-latex"
            aria-label="LaTeX formula"
            value={latex}
            onChange={(event) => setLatex(event.target.value)}
            placeholder="e.g. x^2 + y^2 = z^2"
          />
          <label className="formula-label" htmlFor="formula-size">
            Size
          </label>
          <select
            id="formula-size"
            aria-label="Formula size"
            value={fontSize}
            onChange={(event) => setFontSize(Number(event.target.value))}
          >
            {SIZES.map((size) => (
              <option key={size.value} value={size.value}>
                {size.label}
              </option>
            ))}
          </select>
          {error && (
            <p className="banner error formula-error" role="alert">
              {error}
            </p>
          )}
          <div className="tour-actions">
            <span className="tour-spacer" />
            <button type="button" className="button ghost" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="button" disabled={!latex.trim() || submitting}>
              {submitting ? 'Rendering…' : 'Insert formula'}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
