import { useEffect, useState } from 'react';
import type { ArchModel } from '../../shared/arch-model.ts';
import { archApi, type ArchReviewSidecar } from '../lib/api.ts';
import { errorMessage } from '../lib/errors.ts';
import './ReviewSection.css';

interface ReviewSectionProps {
  name: string;
  model: ArchModel | null;
}

export function ReviewSection({ name, model }: ReviewSectionProps) {
  const [saved, setSaved] = useState<ArchReviewSidecar | null>(null);
  const [stale, setStale] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [skipped, setSkipped] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setSaved(null);
    setStale(false);
    setConfirming(false);
    setSkipped(0);
    setError(null);
    archApi
      .review(name)
      .then(({ review, stale: isStale }) => {
        if (!cancelled) {
          setSaved(review ?? null);
          setStale(isStale);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(errorMessage(err));
      });
    return () => {
      cancelled = true;
    };
  }, [name, model?.generatedAt]);

  async function runReview(): Promise<void> {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const result = await archApi.runReview(name);
      setSaved(result.review);
      setStale(false);
      setSkipped(result.skipped);
      setConfirming(false);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function copyMarkdown(): Promise<void> {
    if (!saved) return;
    const markdown = saved.review.findings
      .map(
        (finding) =>
          `- [ ] **${finding.title}** (${finding.severity}): ${finding.suggestion.replace(/[.!?]+$/, '')}. Evidence: ${finding.evidence.join(', ')}`,
      )
      .join('\n');
    try {
      await navigator.clipboard.writeText(markdown);
      setNotice('Review copied as Markdown.');
    } catch {
      setError('Copying is not available in this browser.');
    }
  }

  const componentCount = model?.nodes.filter((node) => node.kind === 'component').length ?? 0;
  const labels = new Map(model?.nodes.map((node) => [node.id, node.label]) ?? []);
  const isStale = stale || (saved !== null && saved.modelGeneratedAt !== model?.generatedAt);

  return (
    <section className="arch-review" aria-label="AI review">
      <h3>AI review</h3>
      {isStale && <p className="muted small">The map changed since this review. Run it again.</p>}
      {!isStale && saved && (
        <>
          <p className="small">{saved.review.summary}</p>
          <ul className="plain-list small">
            {saved.review.findings.map((finding, index) => (
              <li key={`${finding.title}-${index}`} className="arch-review-finding">
                <strong>{finding.title}</strong>
                <span className={`finding-severity finding-${finding.severity}`}>
                  {finding.severity}
                </span>
                <p>{finding.suggestion}</p>
                <p className="muted">
                  Evidence: {finding.evidence.map((id) => labels.get(id) ?? id).join(', ')}
                </p>
              </li>
            ))}
          </ul>
          {skipped > 0 && (
            <p className="muted small">
              {skipped} finding(s) skipped because their evidence did not match this map.
            </p>
          )}
          <button type="button" className="button ghost small" onClick={() => void copyMarkdown()}>
            Copy as Markdown
          </button>
        </>
      )}
      {confirming && (
        <>
          <p className="small muted">
            Send {componentCount} folder paths and labels and their findings, no file contents or
            file names.
          </p>
          <button
            type="button"
            className="button primary small"
            disabled={busy || !model}
            onClick={() => void runReview()}
          >
            {busy ? 'Reviewing…' : 'Confirm and send'}
          </button>
        </>
      )}
      {!confirming && (
        <button
          type="button"
          className="button ghost small"
          disabled={busy || !model}
          onClick={() => setConfirming(true)}
        >
          Review with AI
        </button>
      )}
      {error && (
        <p role="alert" className="banner error">
          {error}
        </p>
      )}
      {notice && <p className="banner notice">{notice}</p>}
    </section>
  );
}
