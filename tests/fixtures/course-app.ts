import express from 'express';
import request from 'supertest';
import { errorHandler } from '../../src/server/errors.ts';
import type { AiProvider } from '../../src/server/ai/provider.ts';
import type { SourceCheckDeps } from '../../src/server/learn/sources.ts';
import { createCourseRouter } from '../../src/server/routes/learn-courses.ts';
import { createCourseStore } from '../../src/server/storage/course-store.ts';
import { createCourseQuizStore } from '../../src/server/storage/course-quiz-store.ts';
import { createLessonStore } from '../../src/server/storage/lesson-store.ts';
import { testServices } from './ai-services.ts';

export const NOW = '2026-11-24T10:00:00.000Z';

export const OUTLINE = {
  title: 'HTTP caching',
  modules: [
    {
      title: 'Basics',
      topics: [
        { title: 'What a cache is', summary: 'A cache keeps a copy of a response.' },
        { title: 'Freshness', summary: 'A copy stays fresh for a set time.' },
      ],
    },
    {
      title: 'Checking copies',
      topics: [{ title: 'Validators', summary: 'A validator asks whether a copy is still good.' }],
    },
  ],
};

export const LESSON = {
  title: 'What a cache is',
  explanation: 'A cache keeps a copy of a response so the next request can reuse it.',
  keyTerms: ['cache'],
  sources: [
    {
      title: 'MDN: HTTP caching',
      url: 'https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/Caching',
      points: ['Caches store copies of responses.'],
    },
  ],
  diagram: {
    nodes: [
      { id: 'client', label: 'Client' },
      { id: 'cache', label: 'Cache' },
    ],
    edges: [{ from: 'client', to: 'cache', label: 'request' }],
    direction: 'right',
    title: 'Caching',
  },
};

export const PUBLIC_CHECKS: SourceCheckDeps = {
  lookup: async () => ['93.184.216.34'],
  request: async () => ({ status: 200, location: null, contentType: 'text/html' }),
};

export const MISSING_CHECKS: SourceCheckDeps = {
  lookup: async () => ['93.184.216.34'],
  request: async () => ({ status: 404, location: null, contentType: 'text/html' }),
};

/** The learn course API, mounted the way the app mounts it, over the given data folder. */
export function courseApp(
  dir: string,
  provider: AiProvider,
  checks: SourceCheckDeps = PUBLIC_CHECKS,
): express.Express {
  const app = express();
  app.use(express.json());
  app.use(
    '/api/learn',
    createCourseRouter(
      createCourseStore(dir),
      createLessonStore(dir),
      createCourseQuizStore(dir),
      testServices({ claude: provider, codex: provider }),
      checks,
      () => new Date(NOW),
    ),
  );
  app.use(errorHandler);
  return app;
}

export async function createCourse(app: express.Express) {
  const res = await request(app).post('/api/learn/courses').send({ topic: 'HTTP caching' });
  return res.body.course;
}
