import { rm } from 'node:fs/promises';
import path from 'node:path';
import { expect, test } from '@playwright/test';

const DIAGRAMS_DIR = path.resolve('data/e2e-diagrams');
const NAME = 'e2e ai';

interface SavedElement {
  type: string;
  isDeleted?: boolean;
  startBinding?: unknown;
  endBinding?: unknown;
}

async function liveElements(
  request: import('@playwright/test').APIRequestContext,
  name: string,
): Promise<SavedElement[]> {
  const saved = await request.get(`/api/diagrams/${encodeURIComponent(name)}`);
  const scene = (await saved.json()) as { elements: SavedElement[] };
  return scene.elements.filter((el) => !el.isDeleted);
}

// The AI CLIs are stubbed here so the browser test is fast and uses no subscription quota.
// The real CLIs were exercised separately against the live server.
const STATUS = {
  defaultProvider: 'claude',
  providers: [
    {
      id: 'claude',
      label: 'Claude Code',
      installed: true,
      loggedIn: true,
      detail: 'Signed in.',
      account: { email: null, plan: null, organization: null, method: 'Claude subscription' },
      models: [],
      selection: { model: null, effort: null },
      cliDefault: { model: null, effort: null },
      canPasteCode: true,
      login: null,
    },
    {
      id: 'codex',
      label: 'Codex',
      installed: true,
      loggedIn: false,
      detail: 'Not signed in.',
      account: null,
      models: [],
      selection: { model: null, effort: null },
      cliDefault: { model: null, effort: null },
      canPasteCode: false,
      login: null,
    },
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
  await page.route('**/api/ai/providers', (route) => route.fulfill({ json: STATUS }));
  await page.route('**/api/ai/generate', (route) =>
    route.fulfill({ json: { provider: 'claude', graph: GRAPH } }),
  );

  await page.goto('/');
  await page.getByPlaceholder('Name a new drawing').fill(NAME);
  await page.getByRole('button', { name: 'Create' }).click();
  await expect(page.locator('.excalidraw')).toBeVisible({ timeout: 30_000 });

  await page.getByRole('button', { name: /Generate/ }).click();
  const panel = page.getByRole('dialog', { name: 'Generate a diagram' });
  await expect(panel.getByText('Claude Code', { exact: true })).toBeVisible();

  await panel.getByLabel('Describe the diagram').fill('An API that reads from a database');
  await panel.getByRole('button', { name: 'Generate' }).click();
  await expect(panel.getByText(/2 shapes and 1 connections/)).toBeVisible();
  await panel.getByRole('button', { name: 'Add to drawing' }).click();

  await expect
    .poll(
      async () =>
        (await liveElements(request, NAME))
          .filter((el) => el.type !== 'text')
          .map((el) => el.type)
          .sort(),
      {
        timeout: 15_000,
      },
    )
    .toEqual(['arrow', 'ellipse', 'rectangle']);
});

test('chat adds shapes and a glued arrow to the drawing', async ({ page, request }) => {
  await page.route('**/api/ai/providers', (route) => route.fulfill({ json: STATUS }));
  await page.route('**/api/ai/chat', (route) =>
    route.fulfill({
      json: {
        provider: 'claude',
        reply: 'Added a cache.',
        ops: [
          {
            type: 'addNodes',
            nodes: [
              { id: 'cache', label: 'Cache' },
              { id: 'store', label: 'Store' },
            ],
          },
          { type: 'addEdges', edges: [{ from: 'cache', to: 'store', label: 'writes' }] },
        ],
        rejected: [],
      },
    }),
  );

  await page.goto('/');
  await page.getByPlaceholder('Name a new drawing').fill('e2e chat');
  await page.getByRole('button', { name: 'Create' }).click();
  await expect(page.locator('.excalidraw')).toBeVisible({ timeout: 30_000 });

  await page.getByRole('button', { name: 'Chat' }).click();
  const panel = page.getByRole('dialog', { name: 'Chat about this diagram' });
  await panel.getByPlaceholder('Ask for a change…').fill('Add a cache that writes to a store');
  await panel.getByRole('button', { name: 'Send' }).click();
  // Two shapes and one arrow are three changes.
  await expect(panel.getByText(/3 change\(s\) applied/)).toBeVisible();

  await expect
    .poll(
      async () =>
        (await liveElements(request, 'e2e chat'))
          .filter((el) => el.type !== 'text')
          .map((el) => el.type)
          .sort(),
      { timeout: 15_000 },
    )
    .toEqual(['arrow', 'rectangle', 'rectangle']);
  const arrows = (await liveElements(request, 'e2e chat')).filter((el) => el.type === 'arrow');
  expect(arrows[0]?.startBinding).toBeTruthy();
  expect(arrows[0]?.endBinding).toBeTruthy();
});
