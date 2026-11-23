import { expect, test } from '@playwright/test';

// PRIVACY.md promises that the app sends nothing to a server other than this machine.
// The only outside traffic is the AI CLIs, which run as separate programs and are not in the browser.
test('the browser makes no requests outside this machine while the app is used', async ({
  page,
}) => {
  const outside: string[] = [];
  page.on('request', (req) => {
    const host = new URL(req.url()).hostname;
    if (host !== '127.0.0.1' && host !== 'localhost') outside.push(req.url());
  });

  await page.goto('/');
  await page.getByPlaceholder('Name a new drawing').fill('privacy check');
  await page.getByRole('button', { name: 'Create' }).click();
  await expect(page.locator('.excalidraw')).toBeVisible({ timeout: 30_000 });
  await page.waitForTimeout(1_000);

  await page.goto('/#/ai');
  await expect(page.getByRole('heading', { name: 'AI tools' })).toBeVisible();

  expect(outside).toEqual([]);
});
