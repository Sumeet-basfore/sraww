import type { Page } from '@playwright/test';
import { expect, test } from './fixtures.ts';

const lesson = {
  id: 'lesson-e2e-1',
  topic: 'How HTTP caching works',
  title: 'HTTP caching: keep a copy, check it is fresh',
  explanation:
    'A cache keeps a copy of a response.\n\nCache-Control says how long the copy stays fresh.',
  keyTerms: ['Cache-Control'],
  sources: [
    {
      title: 'HTTP caching guide',
      url: 'https://developer.mozilla.org/en-US/docs/Web/HTTP/Caching',
      points: ['Freshness is set by max-age.'],
    },
  ],
  diagram: {
    direction: 'right',
    nodes: [
      { id: 'browser', label: 'Browser', shape: 'rounded' },
      { id: 'cache', label: 'Cache', shape: 'rounded' },
    ],
    edges: [{ from: 'browser', to: 'cache', label: 'asks first' }],
  },
  createdAt: '2026-11-24T10:00:00.000Z',
  provider: 'claude',
};

const readyProviders = {
  defaultProvider: 'claude',
  providers: [
    { id: 'claude', label: 'Claude Code', installed: true, loggedIn: true },
    { id: 'codex', label: 'Codex', installed: true, loggedIn: false },
  ],
};

const codexProviders = {
  defaultProvider: 'codex',
  providers: [
    { id: 'claude', label: 'Claude Code', installed: true, loggedIn: true },
    { id: 'codex', label: 'Codex', installed: true, loggedIn: true },
  ],
};

function json(body: unknown, status = 200) {
  return { status, contentType: 'application/json', body: JSON.stringify(body) };
}

async function stubProviders(page: Page, providers: unknown): Promise<void> {
  await page.route('**/api/ai/providers', (route) => route.fulfill(json(providers)));
}

test('a topic is built into a lesson with its diagram, explanation, key term and source', async ({
  page,
}) => {
  let sent: unknown = null;
  await stubProviders(page, readyProviders);
  await page.route('**/api/learn/lessons', async (route) => {
    sent = route.request().postDataJSON();
    await route.fulfill(json({ lesson, skippedSources: 0 }, 201));
  });
  await page.route(`**/api/learn/lessons/${lesson.id}`, (route) => route.fulfill(json({ lesson })));

  await page.goto('/#/learn');
  await page.getByLabel('Topic').fill('  How HTTP caching works  ');
  await page.getByRole('button', { name: 'Build lesson' }).click();

  await expect(page).toHaveURL(/#\/learn\/lesson-e2e-1$/);
  await expect(page.getByRole('heading', { level: 1, name: lesson.title })).toBeVisible();
  await expect(page.getByText('A cache keeps a copy of a response.')).toBeVisible();
  await expect(page.getByText('Cache-Control', { exact: true })).toBeVisible();

  const source = page.getByRole('link', { name: 'HTTP caching guide' });
  await expect(source).toHaveAttribute(
    'href',
    'https://developer.mozilla.org/en-US/docs/Web/HTTP/Caching',
  );
  await expect(source).toHaveAttribute('target', '_blank');
  await expect(source).toHaveAttribute('rel', /noopener/);

  await expect(page.locator('.excalidraw')).toBeVisible();
  await expect(page.getByRole('link', { name: '← Learn' })).toBeVisible();
  expect(sent).toEqual({ topic: 'How HTTP caching works' });
});

test('with Codex as the default tool, the Learn tab explains the switch and locks the form', async ({
  page,
}) => {
  await stubProviders(page, codexProviders);
  await page.goto('/#/learn');

  await expect(
    page.getByText('Lessons use Claude Code. Choose Claude Code under AI tools.'),
  ).toBeVisible();
  await expect(page.getByLabel('Topic')).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Build lesson' })).toBeDisabled();
});

test('the lesson page stacks the drawing above the explanation and fits a phone', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route(`**/api/learn/lessons/${lesson.id}`, (route) => route.fulfill(json({ lesson })));

  await page.goto(`/#/learn/${lesson.id}`);
  await expect(page.getByRole('heading', { level: 1, name: lesson.title })).toBeVisible();
  await expect(page.locator('.excalidraw')).toBeVisible();

  const canvas = await page.locator('.lesson-canvas').boundingBox();
  const explanation = await page.getByText('A cache keeps a copy of a response.').boundingBox();
  expect(canvas).not.toBeNull();
  expect(explanation).not.toBeNull();
  expect(canvas!.y + canvas!.height).toBeLessThanOrEqual(explanation!.y);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});
