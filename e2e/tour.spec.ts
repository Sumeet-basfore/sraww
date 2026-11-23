import { expect, test } from '@playwright/test';

// This spec uses the plain Playwright test, so each run starts with a browser that has never seen
// the walkthrough. The other specs skip it through e2e/fixtures.ts.

test('a first visit opens the walkthrough once, and Escape keeps it closed after a reload', async ({
  page,
}) => {
  await page.goto('/');
  const welcome = page.getByRole('dialog', { name: 'Welcome to sraww' });
  await expect(welcome).toBeVisible();
  await expect(welcome.getByText('Step 1 of 8')).toBeVisible();

  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);

  await page.reload();
  await expect(page.getByRole('heading', { name: 'Diagrams' })).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('the start page reopens the walkthrough and steps through it', async ({ page }) => {
  await page.goto('/');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);

  await page.getByRole('button', { name: 'Take the tour' }).click();
  const dialog = page.getByRole('dialog', { name: 'Welcome to sraww' });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Next' }).click();
  await expect(page.getByRole('dialog', { name: 'Drawings' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
});
