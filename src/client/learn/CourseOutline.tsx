import type { Course } from '../../shared/learn.ts';

interface CourseOutlineProps {
  modules: Course['modules'];
  builtLessons: Record<string, string>;
  lastOpenedId: string | null;
  /** The topic whose lesson is being built, or null. Every open button waits while one is building. */
  opening: string | null;
  onOpen: (topicId: string) => void;
}

/** The modules and topics of a course, each topic with its status and its open button. */
export function CourseOutline({
  modules,
  builtLessons,
  lastOpenedId,
  opening,
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
                <button
                  type="button"
                  className="button course-topic-open"
                  disabled={opening !== null}
                  onClick={() => onOpen(topic.id)}
                >
                  {opening === topic.id ? 'Building the lesson…' : 'Open lesson'}
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
