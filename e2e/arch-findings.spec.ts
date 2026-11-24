import { expect, test } from './fixtures.ts';

const NAME = 'e2e findings map';

test('shows structural findings, selects their boxes and makes no AI request', async ({
  page,
  request,
}) => {
  const aiRequests: string[] = [];
  await request.delete(`/api/diagrams/${encodeURIComponent(NAME)}`);
  await page.goto('/#/architecture');
  await expect(page.getByRole('heading', { name: 'Map a project' })).toBeVisible();
  await page.waitForLoadState('networkidle');
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (url.pathname.startsWith('/api/ai/') && url.pathname !== '/api/ai/providers') {
      aiRequests.push(request.url());
    }
  });
  await page.getByLabel('Diagram name', { exact: true }).fill(NAME);
  await page.getByRole('button', { name: 'Map project' }).click();

  await expect(page.getByRole('heading', { name: 'Architecture' })).toBeVisible({
    timeout: 30_000,
  });
  const finding = page.getByRole('button', { name: 'Show Dependency cycle on map' });
  await expect(finding).toBeVisible();
  await finding.click();

  await expect(finding).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('region', { name: 'Selected folder' })).toBeVisible();
  expect(aiRequests).toEqual([]);
});
