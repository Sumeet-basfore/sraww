import { useEffect, useState } from 'react';
import { diagramApi } from '../lib/api.ts';
import { errorMessage } from '../lib/errors.ts';
import { PageHeader } from '../nav/PageHeader.tsx';
import { ProjectsSection } from '../projects/ProjectsSection.tsx';
import { ArchNewForm } from './ArchNewForm.tsx';
import '../diagrams/start.css';

interface ArchitecturePageProps {
  onOpenArchitecture: (name: string) => void;
  onShowTour: () => void;
}

/** The Architecture tab: upload or pick a code project, then map it. */
export function ArchitecturePage({ onOpenArchitecture, onShowTour }: ArchitecturePageProps) {
  const [names, setNames] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  // Bumped after a project is added or removed, so the map form lists the change.
  const [projectsVersion, setProjectsVersion] = useState(0);

  useEffect(() => {
    let cancelled = false;
    diagramApi
      .list()
      .then((items) => {
        if (!cancelled) setNames(items.map((item) => item.name));
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(errorMessage(err));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="app">
      <main className="page start-page-container">
        <section className="diagram-list start-page" aria-labelledby="architecture-title">
          <PageHeader current="architecture">
            <button type="button" className="link-button" onClick={onShowTour}>
              Take the tour
            </button>
          </PageHeader>

          <div className="intro">
            <h1 id="architecture-title">Architecture</h1>
          </div>
          <p className="muted">
            A map shows which folders of a project depend on each other. Upload a project first,
            then map it.
          </p>

          {error && (
            <p role="alert" className="banner error">
              {error}
            </p>
          )}

          <div className="start-tools">
            <ProjectsSection onChanged={() => setProjectsVersion((v) => v + 1)} />
            <ArchNewForm key={projectsVersion} existingNames={names} onOpen={onOpenArchitecture} />
          </div>
        </section>
      </main>
    </div>
  );
}
