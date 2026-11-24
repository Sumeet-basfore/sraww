import type { Lesson, LessonSource } from '../../shared/learn.ts';

interface LessonPanelProps {
  lesson: Lesson;
}

function paragraphsOf(text: string): string[] {
  return text
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter((paragraph) => paragraph !== '');
}

/** Lesson files can be hand-edited, so an address may not parse. Returns null instead of throwing. */
function addressOf(url: string): URL | null {
  try {
    return new URL(url);
  } catch {
    return null;
  }
}

function SourceItem({ source }: { source: LessonSource }) {
  const address = addressOf(source.url);
  const host = address?.hostname ?? '';
  return (
    <li>
      {address?.protocol === 'https:' ? (
        <a href={source.url} target="_blank" rel="noopener noreferrer">
          {source.title}
        </a>
      ) : (
        <span>{source.title}</span>
      )}
      {host !== '' && <span className="source-host">{host}</span>}
      <ul>
        {source.points.map((point) => (
          <li key={point}>{point}</li>
        ))}
      </ul>
    </li>
  );
}

export function LessonPanel({ lesson }: LessonPanelProps) {
  return (
    <div className="lesson-panel">
      {paragraphsOf(lesson.explanation).map((paragraph, index) => (
        <p key={index}>{paragraph}</p>
      ))}

      {lesson.keyTerms.length > 0 && (
        <>
          <h2>Key terms</h2>
          <ul className="key-terms">
            {lesson.keyTerms.map((term) => (
              <li key={term}>{term}</li>
            ))}
          </ul>
        </>
      )}

      <section className="lesson-sources" aria-labelledby="lesson-sources-title">
        <h2 id="lesson-sources-title">Sources</h2>
        <ol className="source-list">
          {lesson.sources.map((source) => (
            <SourceItem key={source.url} source={source} />
          ))}
        </ol>
        <p className="muted">Read the sources to check this explanation.</p>
      </section>
    </div>
  );
}
