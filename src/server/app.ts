import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import express from 'express';
import type { AppConfig } from './config.ts';
import { createAiServices, type AiServices } from './ai/services.ts';
import { errorHandler } from './errors.ts';
import { localOnlyGuard } from './guard.ts';
import { createArchRouter } from './routes/arch.ts';
import { createAiRouter } from './routes/ai.ts';
import { createArchStore } from './storage/arch-store.ts';
import { createLessonStore } from './storage/lesson-store.ts';
import { createCourseStore } from './storage/course-store.ts';
import { createCourseQuizStore } from './storage/course-quiz-store.ts';
import { createLearnRouter } from './routes/learn.ts';
import { createCourseRouter } from './routes/learn-courses.ts';
import { listArchProjects } from './arch/projects.ts';
import { createDiagramRouter } from './routes/diagrams.ts';
import { createLibraryRouter } from './routes/library.ts';
import { createLibraryStore } from './storage/library-store.ts';
import { createProjectRouter } from './routes/projects.ts';
import { createProjectStore } from './projects/store.ts';
import type { fetchRepoZip } from './projects/github.ts';
import { uploadedArchProjects } from './projects/arch-projects.ts';
import type { ArchProject } from './arch/projects.ts';
import { createDiagramStore, type DiagramStore } from './storage/diagram-store.ts';
import { createMathRouter } from './routes/math.ts';

export const JSON_BODY_LIMIT = '10mb';

/** Only this origin may load scripts, styles, fonts, images or connections. Nothing is framed. */
export const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "frame-ancestors 'none'",
].join('; ');
export const CLIENT_BUILD_DIR = path.resolve('dist/client');

/** Builds the Express app. Dependencies are injectable so tests can use temporary folders and fake CLIs. */
export function createApp(
  config: AppConfig,
  store: DiagramStore = createDiagramStore(config.DIAGRAMS_DIR),
  clientDir: string = CLIENT_BUILD_DIR,
  ai: AiServices = createAiServices(config),
  projects: { fetchRepo?: typeof fetchRepoZip } = {},
): express.Express {
  const app = express();
  const projectStore = createProjectStore(config.PROJECTS_DIR);
  const archProjects = async (): Promise<ArchProject[]> => [
    ...listArchProjects(config.ARCH_PROJECTS),
    ...(await uploadedArchProjects(projectStore)),
  ];
  app.disable('x-powered-by');
  app.use(localOnlyGuard);
  app.use((_req, res, next) => {
    res.setHeader('Content-Security-Policy', CONTENT_SECURITY_POLICY);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'no-referrer');
    next();
  });
  app.use(express.json({ limit: JSON_BODY_LIMIT }));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, provider: config.AI_PROVIDER });
  });

  app.use('/api/diagrams', createDiagramRouter(store));
  app.use('/api/math', createMathRouter());
  app.use('/api/library', createLibraryRouter(createLibraryStore(store.dir)));
  app.use('/api/projects', createProjectRouter(projectStore, projects));
  app.use('/api/arch', createArchRouter(createArchStore(store.dir), archProjects, ai));
  const lessons = createLessonStore(store.dir);
  app.use('/api/learn', createLearnRouter(lessons, ai));
  app.use(
    '/api/learn',
    createCourseRouter(createCourseStore(store.dir), lessons, createCourseQuizStore(store.dir), ai),
  );
  app.use('/api/ai', createAiRouter(ai));

  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'Not found' });
  });

  // In production the built client is served from the same origin. The dev server proxies /api instead.
  if (existsSync(path.join(clientDir, 'index.html'))) {
    const privacyFile = path.resolve('PRIVACY.md');
    app.get('/PRIVACY.md', async (_req, res, next) => {
      try {
        res.type('text/markdown').send(await readFile(privacyFile, 'utf8'));
      } catch (err) {
        next(err);
      }
    });
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
