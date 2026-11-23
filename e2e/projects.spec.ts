import { rm } from 'node:fs/promises';
import path from 'node:path';
import { zipSync } from 'fflate';
import { expect, test } from './fixtures.ts';

const PROJECTS_DIR = path.resolve('data/e2e-projects');
const encoder = new TextEncoder();

test.beforeAll(async () => {
  await rm(PROJECTS_DIR, { recursive: true, force: true });
});

test('uploads a project zip after the privacy notice, lists what was left out, and deletes it', async ({
  page,
}) => {
  await page.goto('/');
  const zipButton = page.getByRole('button', { name: 'Upload a zip file' });
  await expect(zipButton).toBeDisabled();
  await page.getByRole('checkbox', { name: /I understand/ }).check();
  await expect(zipButton).toBeEnabled();

  // The .env file is a credential file, so the server must leave it out and say so.
  const zip = zipSync({
    'src/index.ts': encoder.encode('export const ok = true;'),
    '.env': encoder.encode('TOKEN=not-a-real-token'),
  });
  await page.getByLabel('Choose a project zip file').setInputFiles({
    name: 'shop.zip',
    mimeType: 'application/zip',
    buffer: Buffer.from(zip),
  });

  const rows = page.locator('.project-rows');
  await expect(page.getByText(/Uploaded “shop”: 1 file kept/)).toBeVisible();
  await expect(rows.getByText('shop')).toBeVisible();
  await rows.locator('details.excluded summary').click();
  await expect(rows.getByText('.env')).toBeVisible();

  page.once('dialog', (dialog) => void dialog.accept());
  await rows.getByRole('button', { name: 'Delete' }).click();
  await expect(rows).toHaveCount(0);
});
