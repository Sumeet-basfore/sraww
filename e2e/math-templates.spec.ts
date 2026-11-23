import { rm } from 'node:fs/promises';
import path from 'node:path';
import { expect, test } from './fixtures.ts';

const DIAGRAMS_DIR = path.resolve('data/e2e-diagrams');
const NAME = 'math template table';

test.beforeAll(async () => {
  await rm(DIAGRAMS_DIR, { recursive: true, force: true });
});

test('inserts a table template into a new drawing', async ({ page, request }) => {
  await page.goto('/');
  await page.getByPlaceholder('Name a new drawing').fill(NAME);
  await page.getByRole('button', { name: 'Create' }).click();
  await expect(page.getByRole('heading', { name: NAME })).toBeVisible();
  await expect(page.locator('.excalidraw')).toBeVisible({ timeout: 30_000 });

  await page.getByRole('combobox', { name: 'Insert' }).selectOption('table');
  await expect(page.getByRole('status')).toHaveText('All changes saved', { timeout: 15_000 });

  const saved = await request.get(`/api/diagrams/${encodeURIComponent(NAME)}`);
  expect(saved.ok()).toBeTruthy();
  const scene = (await saved.json()) as { elements: Array<{ type: string }> };
  expect(scene.elements.filter((element) => element.type === 'line')).toHaveLength(8);
});
