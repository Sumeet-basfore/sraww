import { Router } from 'express';
import { z } from 'zod';
import { LEARN_LIMITS } from '../../shared/learn.ts';
import type { AiServices } from '../ai/services.ts';
import { buildLesson, toStoredLesson } from '../learn/lesson.ts';
import { defaultSourceCheckDeps, type SourceCheckDeps } from '../learn/sources.ts';
import { DiagramError } from '../storage/diagram-store.ts';
import type { LessonStore } from '../storage/lesson-store.ts';

const createBody = z.object({
  topic: z.string().trim().min(1).max(LEARN_LIMITS.maxTopic),
});

/** Learn routes. A lesson is built from web sources, checked, and then saved. */
export function createLearnRouter(
  store: LessonStore,
  ai: AiServices,
  deps: SourceCheckDeps = defaultSourceCheckDeps,
  now: () => Date = () => new Date(),
): Router {
  const router = Router();

  router.post('/lessons', async (req, res) => {
    const body = createBody.parse(req.body);
    const providerId = ai.currentDefault();
    const built = await buildLesson(ai.providers[providerId], body.topic, deps);
    const lesson = toStoredLesson(built, body.topic, providerId, now());
    await store.save(lesson);
    res.status(201).json({ lesson, skippedSources: built.skippedSources });
  });

  router.get('/lessons/:id', async (req, res) => {
    const lesson = await store.read(req.params.id);
    if (!lesson) throw new DiagramError('NOT_FOUND', 'That lesson does not exist.');
    res.json({ lesson });
  });

  return router;
}
