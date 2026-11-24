import type { ArchDiff } from '../../shared/arch-model.ts';

const LIST_LIMIT = 12;

function describeDiff(diff: ArchDiff): string {
  if (!diff.hasBaseline) return 'First scan. Nothing to compare with yet.';
  const parts = [
    `${diff.addedNodes.length} new / ${diff.removedNodes.length} removed folders`,
    `${diff.addedEdges.length} new / ${diff.removedEdges.length} removed links`,
  ];
  return parts.join(' · ');
}

function Names({ title, items }: { title: string; items: readonly string[] }) {
  if (items.length === 0) return null;
  return (
    <div className="arch-change-list">
      <p className="small muted">{title}</p>
      <ul className="plain-list small">
        {items.slice(0, LIST_LIMIT).map((item) => (
          <li key={item}>
            <code>{item}</code>
          </li>
        ))}
        {items.length > LIST_LIMIT && (
          <li className="muted">and {items.length - LIST_LIMIT} more</li>
        )}
      </ul>
    </div>
  );
}

export function ChangesCard({ diff }: { diff: ArchDiff }) {
  return (
    <section className="arch-changes" aria-label="Changes since last scan">
      <h3>Changes since last scan</h3>
      <p className="small">{describeDiff(diff)}</p>
      <Names title="New folders" items={diff.addedNodes} />
      <Names title="Removed folders" items={diff.removedNodes} />
      <Names title="New links" items={diff.addedEdges} />
      <Names title="Removed links" items={diff.removedEdges} />
    </section>
  );
}
