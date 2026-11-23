// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useAiProviders } from '../../src/client/ai/useAiProviders.ts';
import { PROVIDERS, json } from './ai-fixtures.ts';

function deferred(): { promise: Promise<Response>; resolve: (r: Response) => void } {
  let resolve!: (r: Response) => void;
  const promise = new Promise<Response>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

const fetchMock = vi.fn();

afterEach(() => {
  cleanup();
  fetchMock.mockReset();
  vi.unstubAllGlobals();
});

describe('useAiProviders refresh order', () => {
  it('applies an older refresh that succeeds after a newer one failed', async () => {
    const older = deferred();
    fetchMock
      .mockResolvedValueOnce(json(PROVIDERS)) // the first load
      .mockReturnValueOnce(older.promise) // refresh A, started first, still in flight
      .mockResolvedValueOnce(new Response(null, { status: 500 })); // refresh B, newer, fails
    vi.stubGlobal('fetch', fetchMock);

    const { result } = renderHook(() => useAiProviders());
    await waitFor(() => expect(result.current.state.status).toBe('ready'));

    let refreshA!: Promise<void>;
    act(() => {
      refreshA = result.current.reload();
    });
    await act(async () => {
      await result.current.reload();
    });
    expect(result.current.state).toMatchObject({
      status: 'ready',
      refreshError: expect.any(String),
    });

    await act(async () => {
      older.resolve(json(PROVIDERS));
      await refreshA;
    });
    expect(result.current.state.status).toBe('ready');
    expect(result.current.state).not.toHaveProperty('refreshError');
  });

  it('does not let an older failure raise an alert after a newer refresh started', async () => {
    const older = deferred();
    fetchMock
      .mockResolvedValueOnce(json(PROVIDERS)) // the first load
      .mockReturnValueOnce(older.promise) // refresh A, started first
      .mockResolvedValueOnce(json(PROVIDERS)); // refresh B, newer, succeeds
    vi.stubGlobal('fetch', fetchMock);

    const { result } = renderHook(() => useAiProviders());
    await waitFor(() => expect(result.current.state.status).toBe('ready'));

    let refreshA!: Promise<void>;
    act(() => {
      refreshA = result.current.reload();
    });
    await act(async () => {
      await result.current.reload();
    });
    await act(async () => {
      older.resolve(new Response(null, { status: 500 }));
      await refreshA;
    });
    expect(result.current.state).not.toHaveProperty('refreshError');
  });
});
