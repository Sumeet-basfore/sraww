import { useEffect, useRef, useState } from 'react';
import { ApiError } from '../lib/api.ts';
import { errorMessage } from '../lib/errors.ts';
import { learnApi, type CourseDetail } from '../lib/learn-api.ts';
import { learnHash, lessonHash } from '../lib/route.ts';
import type { ModuleQuizClient, ModuleQuizResultSummary } from '../../shared/learn.ts';
import { PageHeader } from '../nav/PageHeader.tsx';
import { CourseOutline } from './CourseOutline.tsx';
import { ModuleQuizView } from './ModuleQuiz.tsx';
import './learn.css';

type LoadState =
  | { status: 'loading' }
  | { status: 'ready'; detail: CourseDetail }
  | { status: 'missing' }
  | { status: 'failed'; message: string };

type PracticeState =
  | { status: 'closed' }
  | { status: 'loading'; moduleId: string }
  | { status: 'failed'; moduleId: string; message: string }
  | { status: 'ready'; moduleId: string; quiz: ModuleQuizClient };

function quizSummary(quiz: ModuleQuizClient): ModuleQuizResultSummary {
  return {
    attempts: quiz.attempts,
    bestSelfRated: quiz.bestSelfRated,
    lastSelfRated: quiz.lastSelfRated,
    questionCount: quiz.questions.length,
  };
}

interface CoursePageProps {
  id: string;
  onShowTour: () => void;
}

/**
 * One course: its modules and topics. Opening a topic builds its lesson, saves it as the topic
 * last opened, and then shows the lesson.
 */
export function CoursePage({ id, onShowTour }: CoursePageProps) {
  const [load, setLoad] = useState<LoadState>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const [opening, setOpening] = useState<string | null>(null);
  const [openError, setOpenError] = useState<OpenError | null>(null);
  const [practice, setPractice] = useState<PracticeState>({ status: 'closed' });
  const [quizResults, setQuizResults] = useState<Record<string, ModuleQuizResultSummary>>({});
  const practiceRequestId = useRef(0);

  useEffect(() => {
    let cancelled = false;
    setPractice({ status: 'closed' });
    setQuizResults({});
    learnApi
      .course(id)
      .then((detail) => {
        if (!cancelled) {
          setQuizResults(detail.quizResults);
          setLoad({ status: 'ready', detail });
        }
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const missing = err instanceof ApiError && err.status === 404;
        setLoad(missing ? { status: 'missing' } : { status: 'failed', message: errorMessage(err) });
      });
    return () => {
      cancelled = true;
      practiceRequestId.current += 1;
    };
  }, [id, attempt]);

  function retryLoad(): void {
    setLoad({ status: 'loading' });
    setAttempt((count) => count + 1);
    document.getElementById('course-title')?.focus();
  }

  async function openTopic(topicId: string): Promise<void> {
    setOpening(topicId);
    setOpenError(null);
    try {
      const { lesson } = await learnApi.openTopic(id, topicId);
      await learnApi.setProgress(id, topicId);
      window.location.hash = lessonHash(lesson.id);
    } catch (err) {
      setOpening(null);
      setOpenError({ topicId, message: errorMessage(err) });
    }
  }

  async function practiceModule(moduleId: string): Promise<void> {
    const requestId = ++practiceRequestId.current;
    setPractice({ status: 'loading', moduleId });
    try {
      const { quiz } = await learnApi.practiceModule(id, moduleId);
      if (requestId !== practiceRequestId.current) return;
      setQuizResults((current) => ({ ...current, [moduleId]: quizSummary(quiz) }));
      setPractice({ status: 'ready', moduleId, quiz });
    } catch (err) {
      if (requestId === practiceRequestId.current) {
        setPractice({ status: 'failed', moduleId, message: errorMessage(err) });
      }
    }
  }

  function updateQuiz(quiz: ModuleQuizClient): void {
    setQuizResults((current) => ({ ...current, [quiz.moduleId]: quizSummary(quiz) }));
    setPractice((current) =>
      current.status === 'ready' && current.moduleId === quiz.moduleId
        ? { ...current, quiz }
        : current,
    );
  }

  function closePractice(moduleId: string): void {
    practiceRequestId.current += 1;
    setPractice({ status: 'closed' });
    requestAnimationFrame(() => document.getElementById(`practice-${moduleId}`)?.focus());
  }

  const title = load.status === 'ready' ? load.detail.course.title : 'Course';

  return (
    <div className="app">
      <main className="page start-page-container">
        <section className="diagram-list start-page course-page" aria-labelledby="course-title">
          <PageHeader current="learn">
            <button type="button" className="link-button" onClick={onShowTour}>
              Take the tour
            </button>
          </PageHeader>

          <div className="lesson-head">
            <a className="lesson-back" href={learnHash()}>
              ← Learn
            </a>
            <h1 id="course-title" tabIndex={-1}>
              {title}
            </h1>
          </div>

          <CourseBody
            load={load}
            opening={opening}
            openError={openError}
            practice={practice}
            quizResults={quizResults}
            onOpen={openTopic}
            onPractice={practiceModule}
            onRetryPractice={(moduleId) => void practiceModule(moduleId)}
            onUpdateQuiz={updateQuiz}
            onClosePractice={closePractice}
            onRetry={retryLoad}
          />
        </section>
      </main>
    </div>
  );
}

interface OpenError {
  topicId: string;
  message: string;
}

interface CourseBodyProps {
  load: LoadState;
  opening: string | null;
  openError: OpenError | null;
  practice: PracticeState;
  quizResults: Record<string, ModuleQuizResultSummary>;
  onOpen: (topicId: string) => void;
  onPractice: (moduleId: string) => void;
  onRetryPractice: (moduleId: string) => void;
  onUpdateQuiz: (quiz: ModuleQuizClient) => void;
  onClosePractice: (moduleId: string) => void;
  onRetry: () => void;
}

function CourseBody({
  load,
  opening,
  openError,
  practice,
  quizResults,
  onOpen,
  onPractice,
  onRetryPractice,
  onUpdateQuiz,
  onClosePractice,
  onRetry,
}: CourseBodyProps) {
  if (load.status === 'loading') {
    return (
      <p className="muted" role="status">
        Loading the course…
      </p>
    );
  }
  if (load.status === 'missing') {
    return (
      <p role="alert" className="banner error">
        This course could not be found. It may have been removed. Build a new one on the Learn tab.
      </p>
    );
  }
  if (load.status === 'failed') {
    return (
      <>
        <p role="alert" className="banner error">
          {load.message}
        </p>
        <button
          type="button"
          className="button"
          aria-label="Try again: load this course"
          onClick={onRetry}
        >
          Try again
        </button>
      </>
    );
  }

  const { course, builtLessons } = load.detail;
  const lastOpenedId = course.progress.topicId;
  const topics = course.modules.flatMap((module) => module.topics);
  const continueTopic = topics.find((topic) => topic.id === lastOpenedId);
  const anyUnbuilt = topics.some((topic) => !builtLessons[topic.id]);

  return (
    <>
      {openError && (
        <p role="alert" className="banner error">
          {openError.message}
        </p>
      )}
      {continueTopic && (
        <button
          type="button"
          className="button primary course-continue"
          disabled={opening !== null}
          onClick={() => onOpen(continueTopic.id)}
        >
          Continue
        </button>
      )}
      {anyUnbuilt && (
        <p className="course-topic-note">
          Building a lesson uses web research, which can take longer.
        </p>
      )}
      <CourseOutline
        modules={course.modules}
        builtLessons={builtLessons}
        lastOpenedId={lastOpenedId}
        opening={opening}
        failedId={openError?.topicId ?? null}
        onOpen={onOpen}
        quizResults={quizResults}
        practicingModuleId={practice.status === 'loading' ? practice.moduleId : null}
        onPractice={onPractice}
      />
      {practice.status === 'loading' && (
        <p className="course-practice-status" role="status">
          Preparing module practice…
        </p>
      )}
      {practice.status === 'failed' && (
        <section className="module-quiz-error" aria-label="Module practice error">
          <p className="banner error" role="alert">
            {practice.message}
          </p>
          <button
            type="button"
            className="button"
            aria-label="Try again: prepare module practice"
            onClick={() => onRetryPractice(practice.moduleId)}
          >
            Try again
          </button>
          <button
            type="button"
            className="link-button"
            onClick={() => onClosePractice(practice.moduleId)}
          >
            Close practice
          </button>
        </section>
      )}
      {practice.status === 'ready' && (
        <ModuleQuizView
          key={`${practice.moduleId}-${practice.quiz.createdAt}`}
          quiz={practice.quiz}
          moduleTitle={
            course.modules.find((module) => module.id === practice.moduleId)?.title ?? 'Module'
          }
          onQuizUpdate={onUpdateQuiz}
          onClose={() => onClosePractice(practice.moduleId)}
        />
      )}
    </>
  );
}
