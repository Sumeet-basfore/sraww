import { rm } from 'node:fs/promises';
import path from 'node:path';
import { expect, test } from './fixtures.ts';

const DIAGRAMS_DIR = path.resolve('data/e2e-diagrams');
const NAME = 'e2e formula';

test.beforeAll(async () => {
  await rm(DIAGRAMS_DIR, { recursive: true, force: true });
});

test('inserts and renders a LaTeX formula image', async ({ page, request }) => {
  await page.goto('/');
  await page.getByPlaceholder('Name a new drawing').fill(NAME);
  await page.getByRole('button', { name: 'Create' }).click();
  await expect(page.getByRole('heading', { name: NAME })).toBeVisible();
  await expect(page.locator('.excalidraw')).toBeVisible({ timeout: 30_000 });

  await page.getByRole('combobox', { name: 'Insert' }).selectOption('formula');
  const dialog = page.getByRole('dialog', { name: 'Insert formula' });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('textbox', { name: 'LaTeX formula' }).fill('x^2');
  await dialog.getByRole('button', { name: 'Insert formula' }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByRole('status')).toHaveText('All changes saved', { timeout: 15_000 });

  const saved = await request.get(`/api/diagrams/${encodeURIComponent(NAME)}`);
  expect(saved.ok()).toBeTruthy();
  const scene = (await saved.json()) as {
    elements: Array<{
      type: string;
      status?: string;
      scale?: number[];
      customData?: { latex?: string };
    }>;
  };
  const images = scene.elements.filter((element) => element.type === 'image');
  expect(images).toHaveLength(1);
  expect(images[0]).toMatchObject({
    status: 'saved',
    scale: [1, 1],
    customData: { latex: 'x^2' },
  });
});
