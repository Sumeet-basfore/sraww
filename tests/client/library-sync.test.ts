import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createLibrarySync, storable } from '../../src/client/editor/library-sync.ts';

const api = vi.hoisted(() => ({ get: vi.fn(), save: vi.fn() }));

vi.mock('../../src/client/lib/api.ts', () => ({ libraryApi: api }));
vi.mock('@excalidraw/excalidraw', () => import('../mocks/excalidraw.tsx'));

const ITEM = { id: 'box', status: 'unpublished', created: 1, name: 'Box', elements: [] };
const DELAY = 600;

beforeEach(() => {
  vi.useFakeTimers();
  api.get.mockReset();
  api.save.mockReset();
  api.save.mockResolvedValue({ count: 1 });
});

afterEach(() => {
  vi.useRealTimers();
});

describe('library sync', () => {
  it('does not save a change made before the saved library has loaded', async () => {
    api.get.mockReturnValue(new Promise(() => undefined)); // the load never finishes here
    const sync = createLibrarySync({ delayMs: DELAY, onError: () => undefined });
    void sync.initial();
    sync.changed([ITEM]);
    await vi.advanceTimersByTimeAsync(DELAY * 3);
    expect(api.save).not.toHaveBeenCalled();
  });

  it('saves a change after the loaded library is in place', async () => {
    api.get.mockResolvedValue({ items: [] });
    const sync = createLibrarySync({ delayMs: DELAY, onError: () => undefined });
    await sync.initial();
    sync.changed([ITEM]);
    await vi.advanceTimersByTimeAsync(DELAY);
    expect(api.save).toHaveBeenCalledTimes(1);
    expect(api.save.mock.calls[0]?.[0]).toEqual([ITEM]);
  });

  it('stays read-only and never saves when the saved library cannot be loaded', async () => {
    api.get.mockRejectedValue(new Error('offline'));
    const onError = vi.fn();
    const sync = createLibrarySync({ delayMs: DELAY, onError });
    expect(await sync.initial()).toEqual([]);
    sync.changed([ITEM]);
    await sync.flush();
    expect(api.save).not.toHaveBeenCalled();
    expect(onError.mock.calls[0]?.[0]).toMatch(/could not be loaded/);
  });

  it('sends one save at a time and the newest snapshot last', async () => {
    api.get.mockResolvedValue({ items: [] });
    let finishFirst: () => void = () => undefined;
    api.save.mockImplementationOnce(() => new Promise<void>((resolve) => (finishFirst = resolve)));
    api.save.mockResolvedValue({ count: 2 });
    const sync = createLibrarySync({ delayMs: DELAY, onError: () => undefined });
    await sync.initial();

    sync.changed([ITEM]);
    await vi.advanceTimersByTimeAsync(DELAY); // first save starts and waits
    sync.changed([ITEM, { ...ITEM, id: 'second' }]);
    await vi.advanceTimersByTimeAsync(DELAY); // second save must wait for the first
    expect(api.save).toHaveBeenCalledTimes(1);

    finishFirst();
    await sync.flush();
    expect(api.save).toHaveBeenCalledTimes(2);
    expect(api.save.mock.calls[1]?.[0]).toHaveLength(2);
  });

  it('keeps the library in memory for export', async () => {
    api.get.mockResolvedValue({ items: [ITEM] });
    const sync = createLibrarySync({ delayMs: DELAY, onError: () => undefined });
    await sync.initial();
    expect(sync.current()).toEqual([ITEM]);
  });
});

describe('storable', () => {
  it('clips long names and fills in a missing date without changing the rest', () => {
    const out = (
      storable([{ id: 'x', name: 'n'.repeat(500), elements: [{ type: 'rectangle' }] }]) as Array<
        Record<string, unknown>
      >
    )[0]!;
    expect((out.name as string).length).toBe(200);
    expect(out.created).toBe(0);
    expect(out.status).toBe('unpublished');
    expect(out.elements).toEqual([{ type: 'rectangle' }]);
  });
});
