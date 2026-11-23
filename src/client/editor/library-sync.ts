import { getLibraryItemsHash } from '@excalidraw/excalidraw';
import { libraryApi } from '../lib/api.ts';
import { errorMessage } from '../lib/errors.ts';

export interface LibrarySync {
  /** Loads the saved library for Excalidraw when it mounts. */
  initial(): Promise<unknown[]>;
  /** Called whenever Excalidraw's library changes. Saves after a short pause. */
  changed(items: readonly unknown[]): void;
  /** The newest library, for export. */
  current(): readonly unknown[];
  /** Saves any pending change now. */
  flush(): Promise<void>;
  dispose(): void;
}

/**
 * Keeps the Excalidraw library in step with the server. If the saved library cannot be loaded,
 * changes are not saved: writing a partial library would replace the saved one.
 */
export function createLibrarySync(options: {
  delayMs: number;
  onError: (message: string) => void;
}): LibrarySync {
  let items: readonly unknown[] = [];
  let savedHash: number | null = null;
  let readOnly = false;
  let dirty = false;
  let timer: ReturnType<typeof setTimeout> | null = null;

  async function save(): Promise<void> {
    if (!dirty || readOnly) return;
    dirty = false;
    const snapshot = items;
    try {
      await libraryApi.save([...snapshot]);
      savedHash = getLibraryItemsHash(snapshot as never);
    } catch (err) {
      dirty = true;
      options.onError(`The library could not be saved. ${errorMessage(err)}`);
    }
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
        return [...loaded];
      } catch (err) {
        readOnly = true;
        options.onError(
          `The library could not be loaded, so changes to it are not saved. ${errorMessage(err)}`,
        );
        return [];
      }
    },
    changed(next) {
      items = next;
      if (readOnly) return;
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
