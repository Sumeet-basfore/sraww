import { getLibraryItemsHash } from '@excalidraw/excalidraw';
import { libraryApi } from '../lib/api.ts';
import { errorMessage } from '../lib/errors.ts';

const MAX_NAME_CHARS = 200;
const MAX_ELEMENTS = 2_000;

export interface LibrarySync {
  /** Loads the saved library for Excalidraw when it mounts. */
  initial(): Promise<unknown[]>;
  /** Called whenever Excalidraw's library changes. Saves after a short pause, once loaded. */
  changed(items: readonly unknown[]): void;
  /** The newest library, for export. */
  current(): readonly unknown[];
  /** Saves any pending change now, and waits until saves have finished. */
  flush(): Promise<void>;
  dispose(): void;
}

/**
 * Makes a library item acceptable to the server: names are clipped, a missing date is filled in,
 * and the element list is capped. One unusual item then cannot block every save.
 */
export function storable(items: readonly unknown[]): unknown[] {
  return items.map((item) => {
    const record = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>;
    const name = typeof record.name === 'string' ? record.name.slice(0, MAX_NAME_CHARS) : undefined;
    const elements = Array.isArray(record.elements) ? record.elements.slice(0, MAX_ELEMENTS) : [];
    return {
      ...record,
      created: typeof record.created === 'number' ? record.created : 0,
      status: record.status === 'published' ? 'published' : 'unpublished',
      elements,
      ...(name !== undefined ? { name } : {}),
    };
  });
}

/**
 * Keeps the Excalidraw library in step with the server.
 *
 * Nothing is saved until the saved library has loaded, so an early edit cannot write a partial
 * library over the saved one. If the load fails, the library is read-only for this session.
 * Saves run one after another, and each one sends the newest snapshot.
 */
export function createLibrarySync(options: {
  delayMs: number;
  onError: (message: string) => void;
}): LibrarySync {
  let items: readonly unknown[] = [];
  let savedHash: number | null = null;
  let status: 'loading' | 'ready' | 'readonly' = 'loading';
  let dirty = false;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let queue: Promise<void> = Promise.resolve();

  async function saveOnce(): Promise<void> {
    if (status !== 'ready' || !dirty) return;
    dirty = false;
    const snapshot = items;
    const hash = getLibraryItemsHash(snapshot as never);
    try {
      await libraryApi.save(storable(snapshot));
      savedHash = hash;
    } catch (err) {
      dirty = true;
      options.onError(`The library could not be saved. ${errorMessage(err)}`);
    }
  }

  function save(): Promise<void> {
    queue = queue.then(saveOnce, saveOnce);
    return queue;
  }

  function cancelTimer(): void {
    if (timer !== null) clearTimeout(timer);
    timer = null;
  }

  return {
    async initial() {
      try {
        const loaded = (await libraryApi.get()).items;
        items = loaded;
        savedHash = getLibraryItemsHash(loaded as never);
        status = 'ready';
        return [...loaded];
      } catch (err) {
        status = 'readonly';
        options.onError(
          `The library could not be loaded, so changes to it are not saved. ${errorMessage(err)}`,
        );
        return [];
      }
    },
    changed(next) {
      items = next;
      if (status !== 'ready') return;
      if (savedHash !== null && getLibraryItemsHash(next as never) === savedHash) return;
      dirty = true;
      cancelTimer();
      timer = setTimeout(() => {
        timer = null;
        void save();
      }, options.delayMs);
    },
    current: () => items,
    async flush() {
      cancelTimer();
      await save();
    },
    dispose() {
      cancelTimer();
      void save();
    },
  };
}
