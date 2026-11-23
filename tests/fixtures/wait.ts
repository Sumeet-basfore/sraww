/** Polls until `check` passes, so tests can wait on background sign-in progress. */
export async function waitFor(check: () => boolean, timeoutMs = 5_000): Promise<void> {
  const started = Date.now();
  while (!check()) {
    if (Date.now() - started > timeoutMs) throw new Error('Timed out waiting for the condition.');
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
}
