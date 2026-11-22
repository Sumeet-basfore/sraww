import { useSyncExternalStore } from 'react';
import { parseRoute, type Route } from './route.ts';

function subscribe(onChange: () => void): () => void {
  window.addEventListener('hashchange', onChange);
  return () => window.removeEventListener('hashchange', onChange);
}

/** The current route, kept in sync with the URL hash. */
export function useRoute(): Route {
  const hash = useSyncExternalStore(
    subscribe,
    () => window.location.hash,
    () => '',
  );
  return parseRoute(hash);
}
