const STORAGE_KEY = 'sraww.tourSeen';

/**
 * Whether this browser has already finished or skipped the tour. Storage can be blocked, so a
 * failure counts as "not seen": the tour then opens on the next visit, which is harmless.
 */
export function hasSeenTour(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === 'yes';
  } catch {
    return false;
  }
}

export function markTourSeen(): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, 'yes');
  } catch {
    // Private windows can refuse storage. The tour may open again next time, which is harmless.
  }
}
