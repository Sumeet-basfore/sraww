import { rm } from 'node:fs/promises';
import path from 'node:path';
import { expect, test } from './fixtures.ts';

const DIAGRAMS_DIR = path.resolve(process.env.E2E_DATA_DIR ?? '/tmp/sraww-e2e', 'diagrams');
const NAME = 'e2e editor menus';
let drawingSequence = 0;

test.beforeAll(async () => {
  await rm(DIAGRAMS_DIR, { recursive: true, force: true });
});

async function openDrawing(page: import('@playwright/test').Page): Promise<string> {
  drawingSequence += 1;
  const name = `${NAME} ${drawingSequence}`;
  await page.goto('/');
  await page.getByPlaceholder('Name a new drawing').fill(name);
  await page.getByRole('button', { name: 'Create' }).click();
  await expect(page.getByRole('heading', { name })).toBeVisible();
  await expect(page.locator('.excalidraw')).toBeVisible({ timeout: 30_000 });
  return name;
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
  await page.getByRole('button', { name: 'Switch to dark mode' }).click();
  await expect(menu).toBeHidden();
  await expect(insert).toBeFocused();
});

test('insert actions update the saved drawing and Formula keeps focus in its dialog', async ({
  page,
  request,
}) => {
  const name = await openDrawing(page);
  const insert = page.getByRole('button', { name: 'Insert', exact: true });
  await insert.click();
  const menu = page.getByRole('menu', { name: 'Insert' });
  await menu.getByRole('menuitem', { name: 'Table' }).click();
  await expect(page.getByRole('status')).toHaveText('All changes saved', { timeout: 15_000 });
  const saved = await request.get(`/api/diagrams/${encodeURIComponent(name)}`);
  expect(saved.ok()).toBeTruthy();
  const scene = (await saved.json()) as { elements: Array<{ type: string }> };
  expect(scene.elements.filter((element) => element.type === 'line')).toHaveLength(8);
  await expect(insert).toBeFocused();

  await insert.click();
  await page
    .getByRole('menu', { name: 'Insert' })
    .getByRole('menuitem', { name: 'Formula (LaTeX)…' })
    .click();
  const dialog = page.getByRole('dialog', { name: 'Insert formula' });
  await expect(dialog).toBeVisible();
  await expect(page.getByLabel('LaTeX formula')).toBeFocused();
});

test('exporting a PNG starts a download', async ({ page }) => {
  await openDrawing(page);
  await page.getByRole('button', { name: 'File', exact: true }).click();
  const menu = page.getByRole('menu', { name: 'File' });
  const downloadPromise = page.waitForEvent('download');
  await menu.getByRole('menuitem', { name: 'Export PNG image' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/\.png$/i);
});

test('drawing style choices expose radio state', async ({ page }) => {
  await openDrawing(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'More', exact: true }).click();
  const hand = page.getByRole('menuitemradio', { name: 'Hand-drawn' });
  const clean = page.getByRole('menuitemradio', { name: 'Clean' });
  await expect(hand).toHaveAttribute('aria-checked', 'true');
  await expect(clean).toHaveAttribute('aria-checked', 'false');
  await clean.click();
  await page.getByRole('button', { name: 'More', exact: true }).click();
  await expect(page.getByRole('menuitemradio', { name: 'Clean' })).toHaveAttribute(
    'aria-checked',
    'true',
  );
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
