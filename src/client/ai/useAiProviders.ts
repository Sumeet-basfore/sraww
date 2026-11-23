import { useCallback, useEffect, useState } from 'react';
import { aiApi } from '../lib/api.ts';
import { errorMessage } from '../lib/errors.ts';
import type { ProvidersView } from '../../shared/ai-account.ts';

export type ProvidersState =
  | { status: 'loading' }
  | { status: 'ready'; data: ProvidersView }
  | { status: 'error'; message: string };

/** Loads both AI tools (account, model and sign-in state). `reload` refreshes after a change. */
export function useAiProviders(): { state: ProvidersState; reload: () => Promise<void> } {
  const [state, setState] = useState<ProvidersState>({ status: 'loading' });

  const reload = useCallback(async (): Promise<void> => {
    try {
      setState({ status: 'ready', data: await aiApi.providers() });
    } catch (err) {
      setState({ status: 'error', message: errorMessage(err) });
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { state, reload };
}
