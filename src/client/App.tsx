import { lazy, Suspense, useEffect } from 'react';
import { DiagramList } from './diagrams/DiagramList.tsx';
import { editorHash } from './lib/route.ts';
import { loadPrefs } from './lib/prefs.ts';
import { useRoute } from './lib/useRoute.ts';

// The editor pulls in Excalidraw, which is large; load it only when a diagram is opened.
const Editor = lazy(() => import('./editor/Editor.tsx').then((m) => ({ default: m.Editor })));

function goTo(hash: string): void {
  window.location.hash = hash;
}

export function App() {
  const route = useRoute();

  useEffect(() => {
    document.documentElement.dataset.theme = loadPrefs().theme;
  }, []);

  return (
    <div className="app">
      {route.view === 'editor' ? (
        <Suspense fallback={<p className="pad muted">Loading editor…</p>}>
          <Editor key={route.name} name={route.name} onExit={() => goTo('#/')} />
        </Suspense>
      ) : (
        <main className="page">
          <DiagramList onOpen={(name) => goTo(editorHash(name))} />
        </main>
      )}
    </div>
  );
}
