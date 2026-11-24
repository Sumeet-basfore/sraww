import { useEffect, useState, type FormEvent } from 'react';
import { LEARN_LIMITS, type CourseSummary } from '../../shared/learn.ts';
import { errorMessage } from '../lib/errors.ts';
import { learnApi } from '../lib/learn-api.ts';
import { courseHash } from '../lib/route.ts';
import { PageHeader } from '../nav/PageHeader.tsx';
import '../diagrams/start.css';
import './learn.css';

interface LearnPageProps {
  onShowTour: () => void;
}

type BuildState =
  { status: 'idle' } | { status: 'building' } | { status: 'failed'; message: string };

type ListState =
  | { status: 'loading' }
  | { status: 'ready'; courses: CourseSummary[] }
  | { status: 'failed'; message: string };

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { dateStyle: 'medium' });
}

/** The Learn tab. A topic goes in, and the course opens once its outline is built. */
export function LearnPage({ onShowTour }: LearnPageProps) {
  const [topic, setTopic] = useState('');
  const [build, setBuild] = useState<BuildState>({ status: 'idle' });
  const [list, setList] = useState<ListState>({ status: 'loading' });
  const building = build.status === 'building';
  const canSubmit = topic.trim() !== '' && !building;

  useEffect(() => {
    let cancelled = false;
    learnApi
      .courses()
      .then(({ courses }) => {
        if (!cancelled) setList({ status: 'ready', courses });
      })
      .catch((err: unknown) => {
        if (!cancelled) setList({ status: 'failed', message: errorMessage(err) });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!canSubmit) return;
    setBuild({ status: 'building' });
    try {
      const { course } = await learnApi.createCourse(topic.trim());
      window.location.hash = courseHash(course.id);
    } catch (err) {
      setBuild({ status: 'failed', message: errorMessage(err) });
    }
  }

  return (
    <div className="app">
      <main className="page start-page-container">
        <section className="diagram-list start-page" aria-labelledby="learn-title">
          <PageHeader current="learn">
            <button type="button" className="link-button" onClick={onShowTour}>
              Take the tour
            </button>
          </PageHeader>

          <div className="intro">
            <h1 id="learn-title">Learn</h1>
          </div>
          <p className="muted">
            Type a topic and sraww drafts a course of modules and topics. Open a topic to build its
            lesson, with a diagram, an explanation and the web pages it used.
          </p>

          {build.status === 'failed' && (
            <p role="alert" className="banner error">
              {build.message}
            </p>
          )}

          <form className="new-diagram" onSubmit={handleSubmit}>
            <label htmlFor="learn-topic" className="visually-hidden">
              Topic
            </label>
            <input
              id="learn-topic"
              value={topic}
              maxLength={LEARN_LIMITS.maxTopic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="For example: How HTTP caching works"
              disabled={building}
            />
            <button type="submit" className="button primary" disabled={!canSubmit}>
              Build course
            </button>
          </form>

          {building && (
            <p className="muted" role="status">
              Building the course outline. This takes about a minute. Keep this tab open.
            </p>
          )}

          <CourseList state={list} />
        </section>
      </main>
    </div>
  );
}

function CourseList({ state }: { state: ListState }) {
  if (state.status === 'loading') {
    return (
      <p className="muted" role="status">
        Loading your courses…
      </p>
    );
  }
  if (state.status === 'failed') {
    return (
      <p role="alert" className="banner error">
        {state.message}
      </p>
    );
  }
  if (state.courses.length === 0) {
    return <p className="muted">No courses yet. Build one above.</p>;
  }
  return (
    <section aria-labelledby="courses-title">
      <h2 id="courses-title" className="course-section-title">
        Your courses
      </h2>
      <ul className="course-list">
        {state.courses.map((course) => (
          <li key={course.id}>
            <a href={courseHash(course.id)}>{course.title}</a>
            <time dateTime={course.createdAt}>{formatDate(course.createdAt)}</time>
          </li>
        ))}
      </ul>
    </section>
  );
}
