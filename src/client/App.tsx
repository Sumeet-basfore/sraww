import { lazy, Suspense, useEffect, useState } from 'react';
import { DiagramList } from './diagrams/DiagramList.tsx';
import { AiAccountPage } from './ai/account/AiAccountPage.tsx';
import { aiSettingsHash, architectureHash, editorHash, type Route } from './lib/route.ts';
import { loadPrefs } from './lib/prefs.ts';
import { useRoute } from './lib/useRoute.ts';
import { Tour } from './tour/Tour.tsx';
import { hasSeenTour } from './tour/tour-state.ts';

// The editor pulls in Excalidraw, which is large; load it only when a diagram is opened.
const Editor = lazy(() => import('./editor/Editor.tsx').then((m) => ({ default: m.Editor })));

function goTo(hash: string): void {
  window.location.hash = hash;
}

interface PagesProps {
  route: Route;
  onShowTour: () => void;
}

function Pages({ route, onShowTour }: PagesProps) {
  if (route.view === 'list') {
    return (
      <div className="app">
        <main className="page start-page-container">
          <DiagramList
            onOpen={(name) => goTo(editorHash(name))}
            onOpenArchitecture={(name) => goTo(architectureHash(name))}
            onOpenAi={() => goTo(aiSettingsHash())}
            onShowTour={onShowTour}
          />
        </main>
      </div>
    );
  }

  if (route.view === 'ai') {
    return <AiAccountPage onBack={() => goTo('#/')} />;
  }

  const isArchitecture = route.view === 'architecture';
  return (
    <div className="app">
      <Suspense fallback={<p className="pad muted">Loading editor…</p>}>
        <Editor
          key={`${route.view}:${route.name}`}
          name={route.name}
          mode={isArchitecture ? 'architecture' : 'diagram'}
          onExit={() => goTo('#/')}
          onShowTour={onShowTour}
        />
      </Suspense>
    </div>
  );
}

export function App() {
  const route = useRoute();
  // The walkthrough opens by itself the first time this browser visits, and from a button after that.
  const [tourOpen, setTourOpen] = useState(() => !hasSeenTour());

  useEffect(() => {
    document.documentElement.dataset.theme = loadPrefs().theme;
  }, []);

  return (
    <>
      <Pages route={route} onShowTour={() => setTourOpen(true)} />
      <Tour open={tourOpen} onClose={() => setTourOpen(false)} />
    </>
  );
}
