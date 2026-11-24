import type { Lesson } from '../../shared/learn.ts';

interface LessonPanelProps {
  lesson: Lesson;
}

/** Splits text at blank lines. The text is only ever rendered as text, never as HTML. */
function paragraphsOf(text: string): string[] {
  return text
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter((paragraph) => paragraph !== '');
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
            <li key={source.url}>
              <a href={source.url} target="_blank" rel="noopener noreferrer">
                {source.title}
              </a>
              <span className="source-host">{new URL(source.url).hostname}</span>
              <ul>
                {source.points.map((point) => (
                  <li key={point}>{point}</li>
                ))}
              </ul>
            </li>
          ))}
        </ol>
        <p className="muted">Read the sources to check this explanation.</p>
      </section>
    </div>
  );
}
