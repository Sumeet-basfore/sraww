export type SaveStatus = 'saved' | 'unsaved' | 'saving' | 'error';

export interface AutosaveOptions<T> {
  save: (value: T) => Promise<void>;
  /** Cheap identity for a value. Equal fingerprints mean "nothing changed since the last save". */
  fingerprint: (value: T) => string;
  delayMs: number;
  onStatusChange: (status: SaveStatus) => void;
}

export interface Autosave<T> {
  /** Sets the saved baseline, e.g. right after loading a diagram. Nothing is saved. */
  reset(value: T): void;
  /** Records the latest value and schedules a save if it differs from the saved baseline. */
  update(value: T): void;
  /** Saves now. Resolves true when everything is saved, false if the save failed. */
  flush(): Promise<boolean>;
  hasUnsavedChanges(): boolean;
  dispose(): void;
}

/**
 * Debounced, serialized saves. Saves run one at a time; a change made during a save
 * is saved after it. A failed save keeps the value so the next change or flush retries.
 */
export function createAutosave<T>(options: AutosaveOptions<T>): Autosave<T> {
  const { save, fingerprint, delayMs, onStatusChange } = options;
  let savedFingerprint: string | null = null;
  let latest: { value: T; fingerprint: string } | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let queue: Promise<boolean> = Promise.resolve(true);
  let status: SaveStatus = 'saved';

  function setStatus(next: SaveStatus): void {
    if (next === status) return;
    status = next;
    onStatusChange(next);
  }

  function clearTimer(): void {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
  }

  function hasUnsavedChanges(): boolean {
    return latest !== null && latest.fingerprint !== savedFingerprint;
  }

  function scheduleFlush(): void {
    clearTimer();
    timer = setTimeout(() => {
      timer = null;
      void flush();
    }, delayMs);
  }

  async function saveLatest(): Promise<boolean> {
    const target = latest;
    if (!target || target.fingerprint === savedFingerprint) {
      setStatus('saved');
      return true;
    }
    setStatus('saving');
    try {
      await save(target.value);
    } catch {
      setStatus('error');
      return false;
    }
    savedFingerprint = target.fingerprint;
    if (hasUnsavedChanges()) {
      setStatus('unsaved');
      scheduleFlush();
      return false;
    }
    setStatus('saved');
    return true;
  }

  function flush(): Promise<boolean> {
    clearTimer();
    queue = queue.then(saveLatest, saveLatest);
    return queue;
  }

  return {
    reset(value) {
      clearTimer();
      const fp = fingerprint(value);
      latest = { value, fingerprint: fp };
      savedFingerprint = fp;
      setStatus('saved');
    },
    update(value) {
      const fp = fingerprint(value);
      latest = { value, fingerprint: fp };
      if (fp === savedFingerprint) {
        clearTimer();
        if (status !== 'saving') setStatus('saved');
        return;
      }
      setStatus('unsaved');
      scheduleFlush();
    },
    flush,
    hasUnsavedChanges,
    dispose() {
      clearTimer();
    },
  };
}
