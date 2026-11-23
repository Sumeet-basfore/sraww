import { rm } from 'node:fs/promises';
import path from 'node:path';
import { expect, test } from './fixtures.ts';

const DIAGRAMS_DIR = path.resolve(process.env.E2E_DATA_DIR ?? '/tmp/sraww-e2e', 'diagrams');
const NAME = 'e2e menu links';

test.beforeAll(async () => {
  await rm(DIAGRAMS_DIR, { recursive: true, force: true });
});

test("the drawing menu links to sraww's own pages, not Excalidraw's social pages", async ({
  page,
}) => {
  await page.goto('/');
  await page.getByPlaceholder('Name a new drawing').fill(NAME);
  await page.getByRole('button', { name: 'Create' }).click();
  await expect(page.getByRole('heading', { name: NAME })).toBeVisible();
  await expect(page.locator('.excalidraw')).toBeVisible({ timeout: 30_000 });

  await page.locator('.main-menu-trigger').click();
  const menu = page.locator('.dropdown-menu');
  await expect(menu.getByText('sraww on GitHub')).toBeVisible();
  await expect(menu.getByText('Report an issue')).toBeVisible();
  await expect(menu.getByText('Discord')).toHaveCount(0);
  await expect(menu.getByText('YouTube')).toHaveCount(0);
  await expect(menu.getByText('GitHub', { exact: true })).toHaveCount(0);
});
