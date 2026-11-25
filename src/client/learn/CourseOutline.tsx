import type { Course, ModuleQuizResultSummary } from '../../shared/learn.ts';

interface CourseOutlineProps {
  modules: Course['modules'];
  builtLessons: Record<string, string>;
  lastOpenedId: string | null;
  /** The topic whose lesson is being built, or null. Every open button waits while one is building. */
  opening: string | null;
  /** The topic whose last open failed, or null. Its button reads Try again. */
  failedId: string | null;
  onOpen: (topicId: string) => void;
  quizResults: Record<string, ModuleQuizResultSummary>;
  practicingModuleId: string | null;
  onPractice: (moduleId: string) => void;
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
  quizResults,
  practicingModuleId,
  onPractice,
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
                  {openLabel(topic.id, opening, failedId)}
                </button>
              </li>
            ))}
          </ul>
          {module.topics.every((topic) => Boolean(builtLessons[topic.id])) && (
            <div className="course-practice">
              <button
                id={`practice-${module.id}`}
                type="button"
                className="button course-practice-button"
                aria-label={`Practice module: ${module.title}`}
                aria-busy={practicingModuleId === module.id}
                onClick={() => onPractice(module.id)}
              >
                {practicingModuleId === module.id ? 'Preparing practice…' : 'Practice module'}
              </button>
              {quizResults[module.id]?.attempts ? (
                <p className="course-practice-result">
                  Best self-rating: {quizResults[module.id]?.bestSelfRated ?? 0} of{' '}
                  {quizResults[module.id]?.questionCount ?? 0}; last{' '}
                  {quizResults[module.id]?.lastSelfRated ?? 0} of{' '}
                  {quizResults[module.id]?.questionCount ?? 0}
                </p>
              ) : null}
            </div>
          )}
        </section>
      ))}
    </div>
  );
}
