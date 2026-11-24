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
  nodeLabels?: Readonly<Record<string, string>>;
  onFindingsChange?: (findings: ArchFinding[] | null) => void;
  refreshKey?: string;
}

const SEVERITIES = ['high', 'medium', 'low'] as const;

export function FindingsSection({
  name,
  getApi,
  selectedIds,
  onSelection,
  nodeLabels = {},
  onFindingsChange,
  refreshKey,
}: FindingsSectionProps) {
  const [findings, setFindings] = useState<ArchFinding[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setFindings(null);
    setError(null);
    onFindingsChange?.(null);
    archApi
      .findings(name)
      .then(({ findings: loaded }) => {
        if (!cancelled) {
          setFindings(loaded);
          onFindingsChange?.(loaded);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(errorMessage(err));
      });
    return () => {
      cancelled = true;
    };
  }, [name, onFindingsChange, refreshKey]);

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
        <ul className="finding-counts" aria-label="Finding counts">
          {SEVERITIES.map((severity) => (
            <li key={severity}>
              <span
                className={`finding-severity finding-${severity}`}
                aria-label={`${severity[0]?.toUpperCase() + severity.slice(1)} ${counts[severity]}`}
              >
                <span>{severity[0]?.toUpperCase() + severity.slice(1)}</span>
                <strong>{counts[severity]}</strong>
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
        <ul className="arch-finding-list">
          {findings.map((finding) => {
            const nodeIds = finding.nodes.map(elementIds.node);
            const pressed = nodeIds.length > 0 && nodeIds.every((id) => selectedIds.includes(id));
            return (
              <li key={finding.id}>
                <article className="arch-finding">
                  <div className="arch-finding-heading">
                    <strong>{finding.title}</strong>
                    <span className={`finding-severity finding-${finding.severity}`}>
                      {finding.severity[0]?.toUpperCase() + finding.severity.slice(1)}
                    </span>
                  </div>
                  <p>{finding.detail}</p>
                  <p className="arch-finding-folders">
                    <span>Folders</span>
                    {finding.nodes.map((node) => nodeLabels[node] ?? node).join(', ')}
                  </p>
                  <button
                    type="button"
                    className="arch-finding-action"
                    aria-label={`Show ${finding.title} on map`}
                    aria-pressed={pressed}
                    onClick={() => select(finding)}
                  >
                    Show on map
                  </button>
                </article>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
