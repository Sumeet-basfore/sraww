import type { Course } from '../../shared/learn.ts';

interface CourseOutlineProps {
  modules: Course['modules'];
  builtLessons: Record<string, string>;
  lastOpenedId: string | null;
  /** The topic whose lesson is being built, or null. Every open button waits while one is building. */
  opening: string | null;
  /** The topic whose last open failed, or null. Its button reads Try again. */
  failedId: string | null;
  onOpen: (topicId: string) => void;
}

function openLabel(topicId: string, opening: string | null, failedId: string | null): string {
  if (opening === topicId) return 'Building the lesson…';
  return failedId === topicId ? 'Try again' : 'Open lesson';
}

export function CourseOutline({
  modules,
  builtLessons,
  lastOpenedId,
  opening,
  failedId,
  onOpen,
}: CourseOutlineProps) {
  return (
    <div className="course-outline">
      {modules.map((module) => (
        <section key={module.id} className="course-module">
          <h2>{module.title}</h2>
          <ul className="course-topics">
            {module.topics.map((topic) => (
              <li key={topic.id}>
                <h3>{topic.title}</h3>
                <p className="course-topic-summary">{topic.summary}</p>
                <div className="course-topic-meta">
                  <span>{builtLessons[topic.id] ? 'Ready' : 'Not built yet'}</span>
                  {topic.id === lastOpenedId && (
                    <span className="course-topic-tag">Last opened</span>
                  )}
                </div>
                {!builtLessons[topic.id] && (
                  <p className="course-topic-note">
                    Building a lesson uses web research, which can take longer.
                  </p>
                )}
                <button
                  type="button"
                  className="button course-topic-open"
                  disabled={opening !== null}
                  onClick={() => onOpen(topic.id)}
                >
                  {openLabel(topic.id, opening, failedId)}
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
