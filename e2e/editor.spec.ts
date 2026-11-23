import { rm } from 'node:fs/promises';
import path from 'node:path';
import { expect, test } from '@playwright/test';

const DIAGRAMS_DIR = path.resolve('data/e2e-diagrams');
const NAME = 'e2e persistence';

test.beforeAll(async () => {
  await rm(DIAGRAMS_DIR, { recursive: true, force: true });
});

test('draws on a new diagram, reloads, and finds the drawing saved', async ({ page, request }) => {
  await page.goto('/');
  await page.getByPlaceholder('Name a new drawing').fill(NAME);
  await page.getByRole('button', { name: 'Create' }).click();

  await expect(page.getByRole('heading', { name: NAME })).toBeVisible();
  const canvas = page.locator('.excalidraw');
  await expect(canvas).toBeVisible({ timeout: 30_000 });

  // Rectangle tool, then drag a shape in the middle of the canvas.
  await canvas.click({ position: { x: 300, y: 300 } });
  await page.keyboard.press('r');
  const box = await canvas.boundingBox();
  if (!box) throw new Error('canvas has no size');
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  await page.mouse.move(cx - 120, cy - 60);
  await page.mouse.down();
  await page.mouse.move(cx + 120, cy + 60, { steps: 10 });
  await page.mouse.up();

  await expect(page.getByRole('status')).toHaveText('All changes saved', { timeout: 15_000 });

  const saved = await request.get(`/api/diagrams/${encodeURIComponent(NAME)}`);
  expect(saved.ok()).toBeTruthy();
  const scene = (await saved.json()) as { elements: Array<{ type: string }> };
  expect(scene.elements.some((el) => el.type === 'rectangle')).toBeTruthy();

  await page.reload();
  await expect(page.locator('.excalidraw')).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole('status')).toHaveText('All changes saved');
});

test('unknown routes fall back to the app shell and the API stays JSON', async ({
  page,
  request,
}) => {
  await page.goto('/#/diagram/does-not-exist');
  await expect(page.getByRole('alert')).toContainText('not found', { timeout: 15_000 });

  const api = await request.get('/api/nope');
  expect(api.status()).toBe(404);
});
