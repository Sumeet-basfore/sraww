import { existsSync } from 'node:fs';
import path from 'node:path';
import express from 'express';
import type { AppConfig } from './config.ts';
import { createAiServices, type AiServices } from './ai/services.ts';
import { errorHandler } from './errors.ts';
import { localOnlyGuard } from './guard.ts';
import { createAiRouter } from './routes/ai.ts';
import { createDiagramRouter } from './routes/diagrams.ts';
import { createDiagramStore, type DiagramStore } from './storage/diagram-store.ts';

export const JSON_BODY_LIMIT = '10mb';
export const CLIENT_BUILD_DIR = path.resolve('dist/client');

/** Builds the Express app. Dependencies are injectable so tests can use temporary folders and fake CLIs. */
export function createApp(
  config: AppConfig,
  store: DiagramStore = createDiagramStore(config.DIAGRAMS_DIR),
  clientDir: string = CLIENT_BUILD_DIR,
  ai: AiServices = createAiServices(config),
): express.Express {
  const app = express();
  app.disable('x-powered-by');
  app.use(localOnlyGuard);
  app.use(express.json({ limit: JSON_BODY_LIMIT }));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, provider: config.AI_PROVIDER });
  });

  app.use('/api/diagrams', createDiagramRouter(store));
  app.use('/api/ai', createAiRouter(ai));

  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'Not found' });
  });

  // In production the built client is served from the same origin. The dev server proxies /api instead.
  if (existsSync(path.join(clientDir, 'index.html'))) {
    app.use(express.static(clientDir));
    app.get('/{*splat}', (_req, res) => {
      res.sendFile(path.join(clientDir, 'index.html'));
    });
  }

  app.use((_req, res) => {
    res.status(404).json({ error: 'Not found' });
  });
  app.use(errorHandler);

  return app;
}
