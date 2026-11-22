import express from 'express';
import type { AppConfig } from './config.ts';
import { localOnlyGuard } from './guard.ts';

export const JSON_BODY_LIMIT = '10mb';

/** Builds the Express app. Routes are mounted here so tests can build the app without listening. */
export function createApp(config: AppConfig): express.Express {
  const app = express();
  app.disable('x-powered-by');
  app.use(localOnlyGuard);
  app.use(express.json({ limit: JSON_BODY_LIMIT }));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, provider: config.AI_PROVIDER });
  });

  app.use((_req, res) => {
    res.status(404).json({ error: 'Not found' });
  });

  return app;
}
