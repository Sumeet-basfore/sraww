import { useCallback, useEffect, useRef, useState } from 'react';
import { aiApi } from '../lib/api.ts';
import { errorMessage } from '../lib/errors.ts';
import type { ProvidersView } from '../../shared/ai-account.ts';

export type ProvidersState =
  | { status: 'loading' }
  | { status: 'ready'; data: ProvidersView; refreshError?: string }
  | { status: 'error'; message: string };

/** Loads both AI tools (account, model and sign-in state). `reload` refreshes after a change. */
export function useAiProviders(): { state: ProvidersState; reload: () => Promise<void> } {
  const [state, setState] = useState<ProvidersState>({ status: 'loading' });

  // Refreshes can overlap (Retry, or a save's follow-up). A success is applied unless a newer
  // success has already been applied, so fresh data is never overwritten by an older reply. A
  // failure raises an alert only when it comes from the newest request, so an old failure cannot
  // alarm the user after a newer refresh has started.
  const latest = useRef(0);
  const applied = useRef(0);

  const reload = useCallback(async (savedData?: ProvidersView): Promise<void> => {
    latest.current += 1;
    const request = latest.current;
    try {
      const data = await aiApi.providers();
      if (request > applied.current) {
        applied.current = request;
        setState({ status: 'ready', data });
      }
    } catch (err) {
      if (request !== latest.current) return;
      const message = errorMessage(err);
      setState((previous) =>
        previous.status === 'ready'
          ? { ...previous, data: savedData ?? previous.data, refreshError: message }
          : { status: 'error', message },
      );
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { state, reload };
}
