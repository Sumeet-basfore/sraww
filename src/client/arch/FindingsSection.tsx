import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types';
import { useEffect, useState } from 'react';
import type { ArchFinding } from '../../shared/arch-findings.ts';
import { archApi } from '../lib/api.ts';
import { errorMessage } from '../lib/errors.ts';
import { elementIds } from './render.ts';

interface FindingsSectionProps {
  name: string;
  getApi: () => ExcalidrawImperativeAPI | null;
  selectedIds: readonly string[];
  onSelection?: (selectedIds: string[]) => void;
}

const SEVERITIES = ['high', 'medium', 'low'] as const;

export function FindingsSection({ name, getApi, selectedIds, onSelection }: FindingsSectionProps) {
  const [findings, setFindings] = useState<ArchFinding[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setFindings(null);
    setError(null);
    archApi
      .findings(name)
      .then(({ findings: loaded }) => {
        if (!cancelled) setFindings(loaded);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(errorMessage(err));
      });
    return () => {
      cancelled = true;
    };
  }, [name]);

  function select(finding: ArchFinding): void {
    const api = getApi();
    if (!api) return;
    const elementIdsToSelect = finding.nodes.map(elementIds.node);
    api.updateScene({
      appState: {
        selectedElementIds: Object.fromEntries(elementIdsToSelect.map((id) => [id, true])),
      },
    });
    onSelection?.(elementIdsToSelect);
  }

  const counts = Object.fromEntries(
    SEVERITIES.map((severity) => [
      severity,
      findings?.filter((finding) => finding.severity === severity).length ?? 0,
    ]),
  );

  return (
    <section aria-label="Findings" className="arch-findings">
      <h3>Findings</h3>
      {findings && (
        <ul className="plain-list small" aria-label="Finding counts">
          {SEVERITIES.map((severity) => (
            <li key={severity}>
              <span className={`finding-severity finding-${severity}`}>
                {severity[0]?.toUpperCase() + severity.slice(1)} {counts[severity]}
              </span>
            </li>
          ))}
        </ul>
      )}
      {error && (
        <p role="alert" className="banner error">
          {error}
        </p>
      )}
      {findings?.length === 0 && <p className="muted small">Nothing structural to flag.</p>}
      {findings && findings.length > 0 && (
        <ul className="plain-list small">
          {findings.map((finding) => {
            const nodeIds = finding.nodes.map(elementIds.node);
            const pressed = nodeIds.length > 0 && nodeIds.every((id) => selectedIds.includes(id));
            return (
              <li key={finding.id}>
                <button
                  type="button"
                  className="arch-finding"
                  aria-pressed={pressed}
                  onClick={() => select(finding)}
                >
                  <strong>{finding.title}</strong>
                  <span>{finding.detail}</span>
                  <span>
                    Nodes: <code>{finding.nodes.join(', ')}</code>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
