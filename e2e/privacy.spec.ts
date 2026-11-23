import { expect, test } from './fixtures.ts';

// PRIVACY.md promises that the browser contacts nothing outside this machine while the app is used.
// The AI CLIs run as separate programs and are not part of the browser, so they are not covered here.

function isOutside(uri: string): boolean {
  let url: URL;
  try {
    url = new URL(uri);
  } catch {
    return false; // 'inline', 'eval' and similar CSP sources are not hosts
  }
  if (
    url.protocol !== 'http:' &&
    url.protocol !== 'https:' &&
    url.protocol !== 'ws:' &&
    url.protocol !== 'wss:'
  ) {
    return false; // data:, blob: and about: stay in the browser
  }
  return url.hostname !== '127.0.0.1' && url.hostname !== 'localhost';
}

test('the browser makes no requests outside this machine while the app is used', async ({
  page,
}) => {
  const requested: string[] = [];
  const blockedByPolicy: string[] = [];

  // Requests the browser actually makes.
  page.on('request', (req) => {
    if (isOutside(req.url())) requested.push(req.url());
  });

  // Requests the Content Security Policy refuses. The browser never sends these, but a reviewer
  // should still see that the app tried, so they are recorded and fail the test as well.
  await page.exposeFunction('recordBlocked', (uri: string) => {
    if (isOutside(uri)) blockedByPolicy.push(uri);
  });
  await page.addInitScript(() => {
    document.addEventListener('securitypolicyviolation', (event) => {
      (window as unknown as { recordBlocked(uri: string): void }).recordBlocked(event.blockedURI);
    });
  });

  // The drawing list, then a new drawing with its assistant in both of its modes.
  await page.goto('/');
  await page.getByPlaceholder('Name a new drawing').fill('privacy check');
  await page.getByRole('button', { name: 'Create' }).click();
  await expect(page.locator('.excalidraw')).toBeVisible({ timeout: 30_000 });
  await page.waitForLoadState('networkidle');

  const mode = page.getByRole('combobox', { name: 'What the assistant does' });
  await mode.selectOption('new');
  await expect(page.getByRole('button', { name: 'Generate diagram' })).toBeVisible();
  await mode.selectOption('edit');
  await expect(page.getByLabel('Message the assistant')).toBeVisible();
  await page.waitForLoadState('networkidle');

  // The AI tools page.
  await page.goto('/#/ai');
  await expect(page.getByRole('heading', { name: 'AI tools' })).toBeVisible();
  await page.waitForLoadState('networkidle');

  expect(requested).toEqual([]);
  expect(blockedByPolicy).toEqual([]);
});
