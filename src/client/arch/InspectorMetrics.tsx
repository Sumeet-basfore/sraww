interface InspectorMetricsProps {
  folders: number;
  packages: number;
  dependencies: number;
  orphans: number | null;
}

const METRICS = [
  ['Folders', 'folders'],
  ['Packages', 'packages'],
  ['Dependencies', 'dependencies'],
  ['Orphans', 'orphans'],
] as const;

export function InspectorMetrics({
  folders,
  packages,
  dependencies,
  orphans,
}: InspectorMetricsProps) {
  const values = { folders, packages, dependencies, orphans: orphans ?? '—' };

  return (
    <dl className="arch-stats" aria-label="Workspace metrics">
      {METRICS.map(([label, key]) => (
        <div className="arch-stat-card" key={key}>
          <dt>{label}</dt>
          <dd>{values[key]}</dd>
        </div>
      ))}
    </dl>
  );
}
