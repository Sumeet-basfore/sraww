import { rm } from 'node:fs/promises';
import path from 'node:path';
import { expect, test } from '@playwright/test';

const DIAGRAMS_DIR = path.resolve('data/e2e-diagrams');
const NAME = 'e2e ai';

// The AI CLIs are stubbed here so the browser test is fast and uses no subscription quota.
// The real CLIs were exercised separately against the live server.
const STATUS = {
  defaultProvider: 'claude',
  providers: [
    { id: 'claude', installed: true, loggedIn: true, detail: 'Claude Code is logged in.' },
    { id: 'codex', installed: true, loggedIn: false, detail: 'Codex is not logged in.' },
  ],
};

const GRAPH = {
  nodes: [
    { id: 'api', label: 'API' },
    { id: 'db', label: 'Database', shape: 'ellipse' },
  ],
  edges: [{ from: 'api', to: 'db', label: 'reads' }],
};

test.beforeAll(async () => {
  await rm(DIAGRAMS_DIR, { recursive: true, force: true });
});

test('generates a diagram from a prompt and adds it to the drawing', async ({ page, request }) => {
  await page.route('**/api/ai/status', (route) => route.fulfill({ json: STATUS }));
  await page.route('**/api/ai/generate', (route) =>
    route.fulfill({ json: { provider: 'claude', graph: GRAPH } }),
  );

  await page.goto('/');
  await page.getByPlaceholder('Name a new diagram').fill(NAME);
  await page.getByRole('button', { name: 'Create' }).click();
  await expect(page.locator('.excalidraw')).toBeVisible({ timeout: 30_000 });

  await page.getByRole('button', { name: /Generate/ }).click();
  const panel = page.getByRole('dialog', { name: 'Generate with AI' });
  await expect(panel.getByRole('option', { name: /Codex/ })).toBeDisabled();

  await panel.getByLabel('Describe the diagram').fill('An API that reads from a database');
  await panel.getByRole('button', { name: 'Generate' }).click();
  await expect(panel.getByText(/2 shapes and 1 connections/)).toBeVisible();
  await panel.getByRole('button', { name: 'Add to drawing' }).click();

  await expect(page.getByRole('status')).toHaveText('All changes saved', { timeout: 15_000 });
  const saved = await request.get(`/api/diagrams/${encodeURIComponent(NAME)}`);
  const scene = (await saved.json()) as { elements: Array<{ type: string; isDeleted?: boolean }> };
  const live = scene.elements.filter((el) => !el.isDeleted);
  expect(live.filter((el) => el.type === 'rectangle')).toHaveLength(1);
  expect(live.filter((el) => el.type === 'ellipse')).toHaveLength(1);
  expect(live.filter((el) => el.type === 'arrow')).toHaveLength(1);
});
