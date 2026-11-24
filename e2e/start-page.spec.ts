import { expect, test } from './fixtures.ts';

const readyProviders = {
  defaultProvider: 'claude',
  providers: [
    { id: 'claude', label: 'Claude Code', installed: true, loggedIn: true },
    { id: 'codex', label: 'Codex', installed: true, loggedIn: false },
  ],
};

test('the drawings page shows a quiet default AI status, the tour and the four tabs', async ({
  page,
}) => {
  await page.route('**/api/ai/providers', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(readyProviders),
    }),
  );

  await page.goto('/');
  await expect(page.getByRole('status', { name: 'Default AI tool status' })).toHaveText(
    'Claude ready',
  );
  await expect(page.getByRole('button', { name: 'Take the tour' })).toBeVisible();

  const tabs = page.getByRole('navigation', { name: 'Main' });
  await expect(tabs.getByRole('link', { name: 'Drawings' })).toHaveAttribute(
    'aria-current',
    'page',
  );
  await expect(tabs.getByRole('link', { name: 'Learn' })).toBeVisible();
  await expect(tabs.getByRole('link', { name: 'Architecture' })).toBeVisible();
  await expect(tabs.getByRole('link', { name: 'AI tools' })).toBeVisible();
});

test('the architecture tab keeps GitHub import collapsed until it is opened', async ({ page }) => {
  await page.goto('/#/architecture');
  await expect(page.getByRole('heading', { name: 'Code projects' })).toBeVisible();

  const github = page.locator('details.github-import');
  await expect(github).not.toHaveAttribute('open', '');
  await expect(github.getByLabel('GitHub repository (owner/repo)')).toBeHidden();
  await github.locator('summary').click();
  await expect(github.getByLabel('GitHub repository (owner/repo)')).toBeVisible();
});

test('drawing actions remain visible and accessible at desktop and phone widths', async ({
  page,
  request,
}) => {
  const name = 'start page action check';
  await request.delete(`/api/diagrams/${encodeURIComponent(name)}`);
  await request.post('/api/diagrams', { data: { name } });
  await page.goto('/');

  for (const label of [`Rename ${name}`, `Duplicate ${name}`, `Delete ${name}`]) {
    await expect(page.getByRole('button', { name: label })).toBeVisible();
  }

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole('button', { name: `Rename ${name}` })).toBeVisible();
  await expect(page.getByRole('button', { name: `Duplicate ${name}` })).toBeVisible();
  await expect(page.getByRole('button', { name: `Delete ${name}` })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);

  await request.delete(`/api/diagrams/${encodeURIComponent(name)}`);
});

test('the architecture tab stacks code projects above project mapping on mobile', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/#/architecture');
  const projects = await page.getByRole('heading', { name: 'Code projects' }).boundingBox();
  const mapping = await page.getByRole('heading', { name: 'Map a project' }).boundingBox();

  expect(projects).not.toBeNull();
  expect(mapping).not.toBeNull();
  expect(projects!.y).toBeLessThan(mapping!.y);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});

test('the tabs fit a phone without horizontal scrolling', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(page.getByRole('link', { name: 'AI tools' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});

test('a failed providers request leaves the drawings page usable', async ({ page }) => {
  await page.route('**/api/ai/providers', (route) => route.abort());
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Drawings' })).toBeVisible();
  await expect(page.getByRole('status', { name: 'Default AI tool status' })).toHaveText(
    'AI status unavailable',
  );
});

test('an empty project list uses end-user mapping guidance', async ({ page }) => {
  await page.route('**/api/arch/projects', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ projects: [] }),
    }),
  );
  await page.goto('/#/architecture');
  await expect(page.getByText('Upload a project above, then map it here.')).toBeVisible();
  await expect(page.getByText(/ARCH_PROJECTS|\.env/)).toHaveCount(0);
});

test('the learn tab shows the topic field', async ({ page }) => {
  await page.goto('/#/learn');
  await expect(page.getByRole('heading', { name: 'Learn' })).toBeVisible();
  await expect(page.getByLabel('Topic')).toBeVisible();
});
