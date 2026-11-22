/** A short, user-facing message for any thrown value. */
export function errorMessage(err: unknown): string {
  if (err instanceof Error && err.message) return err.message;
  return 'Something went wrong. Check that the local server is running.';
}
