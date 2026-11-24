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
  const [opening, setOpening] = useState<string | null>(null);
  const [openError, setOpenError] = useState<string | null>(null);

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
  }, [id]);

  async function openTopic(topicId: string): Promise<void> {
    setOpening(topicId);
    setOpenError(null);
    try {
      const { lesson } = await learnApi.openTopic(id, topicId);
      await learnApi.setProgress(id, topicId);
      window.location.hash = lessonHash(lesson.id);
    } catch (err) {
      setOpening(null);
      setOpenError(errorMessage(err));
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
            <h1 id="course-title">{title}</h1>
          </div>

          <CourseBody load={load} opening={opening} openError={openError} onOpen={openTopic} />
        </section>
      </main>
    </div>
  );
}

interface CourseBodyProps {
  load: LoadState;
  opening: string | null;
  openError: string | null;
  onOpen: (topicId: string) => void;
}

function CourseBody({ load, opening, openError, onOpen }: CourseBodyProps) {
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
      <p role="alert" className="banner error">
        {load.message}
      </p>
    );
  }

  const { course, builtLessons } = load.detail;
  const lastOpenedId = course.progress.topicId;
  const continueTopic = course.modules
    .flatMap((module) => module.topics)
    .find((topic) => topic.id === lastOpenedId);

  return (
    <>
      {openError && (
        <p role="alert" className="banner error">
          {openError}
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
      <CourseOutline
        modules={course.modules}
        builtLessons={builtLessons}
        lastOpenedId={lastOpenedId}
        opening={opening}
        onOpen={onOpen}
      />
    </>
  );
}
