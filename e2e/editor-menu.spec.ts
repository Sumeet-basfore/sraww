import { rm } from 'node:fs/promises';
import path from 'node:path';
import { expect, test } from './fixtures.ts';

const DIAGRAMS_DIR = path.resolve('data/e2e-diagrams');
const NAME = 'e2e editor menus';
let drawingSequence = 0;

test.beforeAll(async () => {
  await rm(DIAGRAMS_DIR, { recursive: true, force: true });
});

async function openDrawing(page: import('@playwright/test').Page): Promise<void> {
  drawingSequence += 1;
  const name = `${NAME} ${drawingSequence}`;
  await page.goto('/');
  await page.getByPlaceholder('Name a new drawing').fill(name);
  await page.getByRole('button', { name: 'Create' }).click();
  await expect(page.getByRole('heading', { name })).toBeVisible();
  await expect(page.locator('.excalidraw')).toBeVisible({ timeout: 30_000 });
}

test('Insert menu opens, closes on Escape and outside click, and returns focus', async ({
  page,
}) => {
  await openDrawing(page);
  const insert = page.getByRole('button', { name: 'Insert', exact: true });
  await insert.click();
  const menu = page.getByRole('menu', { name: 'Insert' });
  await expect(menu).toBeVisible();
  await expect(menu.getByRole('menuitem', { name: 'Axes' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(menu).toBeHidden();
  await expect(insert).toBeFocused();

  await insert.click();
  await page.locator('.excalidraw').click({ position: { x: 300, y: 300 } });
  await expect(menu).toBeHidden();
});

test('theme toggle says what the next theme action will do', async ({ page }) => {
  await openDrawing(page);
  const toggle = page.getByRole('button', { name: 'Switch to dark mode' });
  await expect(toggle).toBeVisible();
  await toggle.click();
  await expect(page.getByRole('button', { name: 'Switch to light mode' })).toBeVisible();
});

test('assistant composer floats over the canvas', async ({ page }) => {
  await openDrawing(page);
  const canvas = await page.locator('.editor-canvas').boundingBox();
  const composer = await page.locator('.composer').boundingBox();
  expect(canvas).not.toBeNull();
  expect(composer).not.toBeNull();
  if (!canvas || !composer) return;
  expect(composer.y).toBeGreaterThanOrEqual(canvas.y);
  expect(composer.y + composer.height).toBeLessThanOrEqual(canvas.y + canvas.height);
  expect(composer.x).toBeGreaterThan(canvas.x);
  expect(composer.x + composer.width).toBeLessThan(canvas.x + canvas.width);

  await page.setViewportSize({ width: 1024, height: 768 });
  const compactDesktopComposer = await page.locator('.composer').boundingBox();
  expect(compactDesktopComposer).not.toBeNull();
  expect(compactDesktopComposer!.y + compactDesktopComposer!.height).toBeLessThanOrEqual(708);
});

test('phone header puts editor actions and the theme toggle in More without horizontal scroll', async ({
  page,
}) => {
  await openDrawing(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole('button', { name: 'More', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Switch to dark mode' })).toBeHidden();
  await page.getByRole('button', { name: 'More', exact: true }).click();
  const menu = page.getByRole('menu', { name: 'More' });
  await expect(menu.getByRole('menuitem', { name: 'Axes' })).toBeVisible();
  await expect(menu.getByRole('menuitem', { name: 'Export PNG image' })).toBeVisible();
  await expect(menu.getByRole('menuitem', { name: 'Architecture' })).toBeVisible();
  await expect(menu.getByRole('menuitem', { name: 'Switch to dark mode' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
});
