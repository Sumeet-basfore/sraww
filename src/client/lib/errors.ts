/** A short, user-facing message for any thrown value. */
export function errorMessage(err: unknown): string {
  // A request that hit its timeout (AbortSignal.timeout) has a technical message; say what happened.
  if (err instanceof DOMException && err.name === 'TimeoutError') {
    return 'The AI tools took too long to respond. Try again.';
  }
  if (err instanceof Error && err.message) return err.message;
  return 'Something went wrong. Check that the local server is running.';
}
