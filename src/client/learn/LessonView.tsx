import { lazy, Suspense, useEffect, useState } from 'react';
import type { Lesson } from '../../shared/learn.ts';
import { ApiError } from '../lib/api.ts';
import { learnApi } from '../lib/learn-api.ts';
import { errorMessage } from '../lib/errors.ts';
import { courseHash, learnHash } from '../lib/route.ts';
import { PageHeader } from '../nav/PageHeader.tsx';
import { describeDiagram } from './describe-diagram.ts';
import { LessonPanel } from './LessonPanel.tsx';
import './learn.css';

// The canvas pulls in Excalidraw, which is large; load it only when a lesson is opened.
const LessonCanvas = lazy(() =>
  import('./LessonCanvas.tsx').then((m) => ({ default: m.LessonCanvas })),
);

type LoadState =
  | { status: 'loading' }
  | { status: 'ready'; lesson: Lesson }
  | { status: 'missing' }
  | { status: 'failed'; message: string };

interface LessonViewProps {
  id: string;
  onShowTour: () => void;
}

/** One saved lesson: the diagram on the left, the explanation, terms and sources on the right. */
export function LessonView({ id, onShowTour }: LessonViewProps) {
  const [load, setLoad] = useState<LoadState>({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;
    learnApi
      .get(id)
      .then(({ lesson }) => {
        if (!cancelled) setLoad({ status: 'ready', lesson });
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

  const title = load.status === 'ready' ? load.lesson.title : 'Lesson';
  const back = backLinkOf(load);

  return (
    <div className="app">
      <main className="page start-page-container">
        <section className="diagram-list start-page lesson-page" aria-labelledby="lesson-title">
          <PageHeader current="learn">
            <button type="button" className="link-button" onClick={onShowTour}>
              Take the tour
            </button>
          </PageHeader>

          <div className="lesson-head">
            <a className="lesson-back" href={back.href}>
              {back.label}
            </a>
            <h1 id="lesson-title">{title}</h1>
          </div>

          <LessonBody load={load} />
        </section>
      </main>
    </div>
  );
}

/** A lesson built for a course goes back to that course. Any other lesson goes back to the Learn tab. */
function backLinkOf(load: LoadState): { href: string; label: string } {
  if (load.status === 'ready' && load.lesson.courseId) {
    return { href: courseHash(load.lesson.courseId), label: '← Course' };
  }
  return { href: learnHash(), label: '← Learn' };
}

function LessonBody({ load }: { load: LoadState }) {
  if (load.status === 'loading') {
    return (
      <p className="muted" role="status">
        Loading the lesson…
      </p>
    );
  }
  if (load.status === 'missing') {
    return (
      <p role="alert" className="banner error">
        This lesson could not be found. It may have been removed. Build a new one on the Learn tab.
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
  return (
    <div className="lesson-grid">
      <div className="lesson-canvas-column">
        <p className="visually-hidden">{describeDiagram(load.lesson.diagram)}</p>
        <Suspense
          fallback={
            <p className="muted" role="status">
              Drawing the lesson…
            </p>
          }
        >
          <LessonCanvas key={load.lesson.id} diagram={load.lesson.diagram} />
        </Suspense>
      </div>
      <LessonPanel lesson={load.lesson} />
    </div>
  );
}
