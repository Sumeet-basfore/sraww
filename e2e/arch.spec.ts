import { expect, test } from './fixtures.ts';

const NAME = 'e2e sample map';

interface SavedElement {
  id: string;
  type: string;
  isDeleted?: boolean;
  startBinding?: { elementId: string } | null;
  endBinding?: { elementId: string } | null;
}

test('maps the sample project, keeps stable ids and glued arrows, and re-scans', async ({
  page,
  request,
}) => {
  await request.delete(`/api/diagrams/${encodeURIComponent(NAME)}`);
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Map a project' })).toBeVisible();
  await page.getByLabel('Diagram name', { exact: true }).fill(NAME);
  await page.getByRole('button', { name: 'Map project' }).click();

  await expect(page.getByRole('heading', { name: 'Architecture' })).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.locator('.excalidraw')).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole('status')).toHaveText('All changes saved', { timeout: 15_000 });

  const saved = await request.get(`/api/diagrams/${encodeURIComponent(NAME)}`);
  const scene = (await saved.json()) as { elements: SavedElement[] };
  const live = scene.elements.filter((el) => !el.isDeleted);
  const ids = live.map((el) => el.id);
  expect(ids).toEqual(expect.arrayContaining(['node:src', 'node:src/lib', 'node:ext:express']));

  const link = live.find((el) => el.id === 'edge:src>src/lib');
  expect(link?.type).toBe('arrow');
  expect(link?.startBinding?.elementId).toBe('node:src');
  expect(link?.endBinding?.elementId).toBe('node:src/lib');

  await page.getByRole('button', { name: 'Re-scan' }).click();
  await expect(page.getByText(/Re-scanned/)).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole('heading', { name: 'Changes since last scan' })).toBeVisible();
  await expect(page.getByText(/First scan/)).toHaveCount(0);
});
