import { test as base, expect } from '@playwright/test';

/**
 * Specs use this `test` so that the first-visit walkthrough does not cover the page. Only the tour
 * spec, which checks the walkthrough itself, uses the plain Playwright `test`.
 */
export const test = base.extend({
  context: async ({ context }, use) => {
    await context.addInitScript(() => {
      try {
        window.localStorage.setItem('sraww.tourSeen', 'yes');
      } catch {
        // Storage is blocked in this context; the tour may open, which these specs allow for.
      }
    });
    await use(context);
  },
});

export { expect };
