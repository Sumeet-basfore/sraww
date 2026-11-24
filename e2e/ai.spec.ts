import { rm } from 'node:fs/promises';
import path from 'node:path';
import { expect, test } from './fixtures.ts';

const DIAGRAMS_DIR = path.resolve(process.env.E2E_DATA_DIR ?? '/tmp/sraww-e2e', 'diagrams');
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

test('AI tools page shows both accounts and saves the default tool from its radio group', async ({
  page,
}) => {
  let defaultProvider = 'claude';
  const providers = STATUS.providers.map((provider) => ({
    ...provider,
    loggedIn: true,
    detail: 'Signed in.',
  }));
  await page.route('**/api/ai/providers', (route) =>
    route.fulfill({ json: { defaultProvider, providers } }),
  );
  await page.route('**/api/ai/default', async (route) => {
    const body = route.request().postDataJSON() as { provider: string };
    defaultProvider = body.provider;
    await route.fulfill({ json: { defaultProvider } });
  });

  await page.goto('/#/ai');

  await expect(page.getByRole('heading', { name: 'AI tools' })).toBeVisible();
  await expect(page.getByRole('link', { name: '← Drawings' })).toHaveCount(1);
  await expect(page.getByRole('link', { name: 'AI tools' })).toHaveAttribute(
    'aria-current',
    'page',
  );
  await expect(page.getByRole('article', { name: 'Claude Code' })).toBeVisible();
  await expect(page.getByRole('article', { name: 'Codex' })).toBeVisible();
  await expect(page.getByText('Installed', { exact: true })).toHaveCount(2);
  await expect(page.getByText('Signed in', { exact: true })).toHaveCount(2);
  await expect(page.getByRole('group', { name: 'Default tool' })).toBeVisible();
  await expect(page.getByRole('combobox', { name: 'Model' })).toHaveCount(2);

  await page.getByRole('radio', { name: /Codex.*Signed in/ }).check();
  await expect(page.getByRole('radio', { name: /Codex.*Signed in/ })).toBeChecked();
  await expect(page.getByText('Codex now answers Generate and Chat.')).toBeVisible();
});

test('AI tools page can retry when account status fails to load', async ({ page }) => {
  let requests = 0;
  await page.route('**/api/ai/providers', (route) => {
    requests += 1;
    if (requests === 1) return route.fulfill({ status: 503, json: { error: 'CLI unavailable' } });
    return route.fulfill({ json: STATUS });
  });

  await page.goto('/#/ai');

  await expect(page.getByRole('alert')).toContainText('CLI unavailable');
  await page.getByRole('button', { name: 'Retry' }).click();
  await expect(page.getByRole('article', { name: 'Claude Code' })).toBeVisible();
  expect(requests).toBe(2);
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

  // The assistant is docked under the drawing; “New diagram” is its generate mode.
  await page.getByRole('combobox', { name: 'What the assistant does' }).selectOption('new');
  await expect(page.getByRole('combobox', { name: 'AI tool' })).toHaveValue('claude');

  await page.getByLabel('Message the assistant').fill('An API that reads from a database');
  await page.getByRole('button', { name: 'Generate diagram' }).click();
  await expect(page.getByText(/2 shapes and 1 connections/)).toBeVisible();
  await page.getByRole('button', { name: 'Add to drawing' }).click();

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

  // “Edit this drawing” is the assistant's default mode.
  await page.getByLabel('Message the assistant').fill('Add a cache that writes to a store');
  await page.getByRole('button', { name: 'Send' }).click();
  // Two shapes and one arrow are three changes.
  await expect(page.getByText(/3 change\(s\) applied/)).toBeVisible();

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

test('message box has a visible keyboard focus indicator', async ({ page }) => {
  await page.route('**/api/ai/providers', (route) => route.fulfill({ json: STATUS }));

  await page.goto('/');
  await page.getByPlaceholder('Name a new drawing').fill('e2e keyboard focus');
  await page.getByRole('button', { name: 'Create' }).click();
  await expect(page.locator('.excalidraw')).toBeVisible({ timeout: 30_000 });

  const messageBox = page.getByLabel('Message the assistant');
  // Wait until the tool is ready, so the composer controls are enabled and in the tab order.
  await expect(messageBox).toBeEnabled();

  // Tab order inside the form is: message box, Explain selection, mode select. Starting from the
  // mode select, two Shift+Tab presses reach the message box.
  await page.getByRole('combobox', { name: 'What the assistant does' }).focus();
  await page.keyboard.press('Shift+Tab');
  await page.keyboard.press('Shift+Tab');

  await expect(messageBox).toBeFocused();
  await expect
    .poll(() =>
      messageBox.evaluate((el) => {
        const style = getComputedStyle(el);
        return {
          outline: style.outlineStyle,
          width: style.outlineWidth,
          color: style.outlineColor,
        };
      }),
    )
    .toEqual({
      outline: 'solid',
      width: '2px',
      color: expect.stringMatching(/^(?!rgba\(0, 0, 0, 0\)).+/),
    });
});
