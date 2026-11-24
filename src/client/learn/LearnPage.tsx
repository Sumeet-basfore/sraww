import { useState, type FormEvent } from 'react';
import { LEARN_LIMITS } from '../../shared/learn.ts';
import { defaultView } from '../ai/toolSummary.ts';
import { useAiProviders } from '../ai/useAiProviders.ts';
import { learnApi } from '../lib/learn-api.ts';
import { errorMessage } from '../lib/errors.ts';
import { lessonHash } from '../lib/route.ts';
import { PageHeader } from '../nav/PageHeader.tsx';
import '../diagrams/start.css';

interface LearnPageProps {
  onShowTour: () => void;
}

type BuildState =
  { status: 'idle' } | { status: 'building' } | { status: 'failed'; message: string };

/** The Learn tab. A topic goes in, and the lesson page opens once the lesson has been built. */
export function LearnPage({ onShowTour }: LearnPageProps) {
  const [topic, setTopic] = useState('');
  const [build, setBuild] = useState<BuildState>({ status: 'idle' });
  const { state: providers } = useAiProviders();

  // Only a known Codex default blocks the form. While the tools are still loading, the server
  // decides, and its refusal shows in the alert.
  const usesCodex = providers.status === 'ready' && defaultView(providers.data)?.id === 'codex';
  const building = build.status === 'building';
  const locked = building || usesCodex;
  const canSubmit = topic.trim() !== '' && !locked;

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!canSubmit) return;
    setBuild({ status: 'building' });
    try {
      const { lesson } = await learnApi.create(topic.trim());
      window.location.hash = lessonHash(lesson.id);
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
            Type a topic. sraww builds a short lesson with a diagram, an explanation, key terms and
            the web pages it used.
          </p>

          {usesCodex && (
            <p className="banner notice" role="status">
              Lessons use Claude Code. Choose Claude Code under AI tools.
            </p>
          )}
          {build.status === 'failed' && (
            <p role="alert" className="banner error">
              {build.message}
            </p>
          )}

          <form className="new-diagram" onSubmit={handleSubmit}>
            <label htmlFor="lesson-topic" className="visually-hidden">
              Topic
            </label>
            <input
              id="lesson-topic"
              value={topic}
              maxLength={LEARN_LIMITS.maxTopic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="For example: How HTTP caching works"
              disabled={locked}
            />
            <button type="submit" className="button primary" disabled={!canSubmit}>
              Build lesson
            </button>
          </form>

          {building && (
            <p className="muted" role="status">
              Building the lesson. This can take a minute or two. Keep this tab open.
            </p>
          )}
        </section>
      </main>
    </div>
  );
}
