import { Router } from 'express';
import { z } from 'zod';
import { emptyScene } from '../../shared/diagram.ts';
import type { DiagramStore } from '../storage/diagram-store.ts';

const createBody = z.object({ name: z.string(), scene: z.unknown().optional() });
const nameBody = z.object({ name: z.string() });

/** REST routes for diagram files. Name and content validation happens in the store. */
export function createDiagramRouter(store: DiagramStore): Router {
  const router = Router();

  router.get('/', async (_req, res) => {
    res.json({ diagrams: await store.list() });
  });

  router.post('/', async (req, res) => {
    const body = createBody.parse(req.body);
    await store.create(body.name, body.scene ?? emptyScene());
    res.status(201).json({ name: body.name });
  });

  router.get('/:name', async (req, res) => {
    res.json(await store.read(req.params.name));
  });

  router.put('/:name', async (req, res) => {
    await store.write(req.params.name, req.body);
    res.json({ ok: true, savedAt: new Date().toISOString() });
  });

  router.patch('/:name', async (req, res) => {
    const body = nameBody.parse(req.body);
    await store.rename(req.params.name, body.name);
    res.json({ name: body.name });
  });

  router.post('/:name/duplicate', async (req, res) => {
    const body = nameBody.parse(req.body);
    await store.duplicate(req.params.name, body.name);
    res.status(201).json({ name: body.name });
  });

  router.delete('/:name', async (req, res) => {
    await store.remove(req.params.name);
    res.status(204).end();
  });

  return router;
}
