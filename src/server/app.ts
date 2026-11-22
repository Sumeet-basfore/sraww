import express from 'express';
import type { AppConfig } from './config.ts';
import { errorHandler } from './errors.ts';
import { localOnlyGuard } from './guard.ts';
import { createDiagramRouter } from './routes/diagrams.ts';
import { createDiagramStore, type DiagramStore } from './storage/diagram-store.ts';

export const JSON_BODY_LIMIT = '10mb';

/** Builds the Express app. Dependencies are injectable so tests can use a temporary folder. */
export function createApp(
  config: AppConfig,
  store: DiagramStore = createDiagramStore(config.DIAGRAMS_DIR),
): express.Express {
  const app = express();
  app.disable('x-powered-by');
  app.use(localOnlyGuard);
  app.use(express.json({ limit: JSON_BODY_LIMIT }));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, provider: config.AI_PROVIDER });
  });

  app.use('/api/diagrams', createDiagramRouter(store));

  app.use((_req, res) => {
    res.status(404).json({ error: 'Not found' });
  });
  app.use(errorHandler);

  return app;
}
