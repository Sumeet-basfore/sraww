import { useEffect, useState } from 'react';
import { ApiError } from '../lib/api.ts';
import { errorMessage } from '../lib/errors.ts';
import { learnApi, type CourseDetail } from '../lib/learn-api.ts';
import { learnHash, lessonHash } from '../lib/route.ts';
import { PageHeader } from '../nav/PageHeader.tsx';
import { CourseOutline } from './CourseOutline.tsx';
import './learn.css';

type LoadState =
  | { status: 'loading' }
  | { status: 'ready'; detail: CourseDetail }
  | { status: 'missing' }
  | { status: 'failed'; message: string };

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

  useEffect(() => {
    let cancelled = false;
    learnApi
      .course(id)
      .then((detail) => {
        if (!cancelled) setLoad({ status: 'ready', detail });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const missing = err instanceof ApiError && err.status === 404;
        setLoad(missing ? { status: 'missing' } : { status: 'failed', message: errorMessage(err) });
      });
    return () => {
      cancelled = true;
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
            onOpen={openTopic}
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
  onOpen: (topicId: string) => void;
  onRetry: () => void;
}

function CourseBody({ load, opening, openError, onOpen, onRetry }: CourseBodyProps) {
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
      />
    </>
  );
}
