import { PageHeader } from '../nav/PageHeader.tsx';
import '../diagrams/start.css';

interface LearnPageProps {
  onShowTour: () => void;
}

/** The Learn tab. The lesson builder is not part of this phase, so the page only says what is coming. */
export function LearnPage({ onShowTour }: LearnPageProps) {
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
            Learn will teach a topic step by step: a diagram is drawn on the canvas, with the
            sources it came from. It is not ready yet.
          </p>
        </section>
      </main>
    </div>
  );
}
