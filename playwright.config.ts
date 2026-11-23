import path from 'node:path';
import { defineConfig } from '@playwright/test';

const PORT = 4390;
const E2E_DATA_DIR = process.env.E2E_DATA_DIR ?? '/tmp/sraww-e2e';

export default defineConfig({
  testDir: 'e2e',
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    trace: 'retain-on-failure',
  },
  webServer: {
    // Builds the client, then serves it with the API from a throwaway diagrams folder.
    command: 'npm run build && npm start',
    url: `http://127.0.0.1:${PORT}/api/health`,
    reuseExistingServer: false,
    timeout: 180_000,
    env: {
      PORT: String(PORT),
      DIAGRAMS_DIR: path.join(E2E_DATA_DIR, 'diagrams'),
      PROJECTS_DIR: path.join(E2E_DATA_DIR, 'projects'),
      ARCH_PROJECTS: path.resolve('tests/fixtures/sample-project'),
    },
  },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
});
