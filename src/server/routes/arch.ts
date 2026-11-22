import { Router } from 'express';
import { DiagramError } from '../storage/diagram-store.ts';
import type { ArchStore } from '../storage/arch-store.ts';

export function createArchRouter(store: ArchStore): Router {
  const router = Router();

  router.get('/:name', async (req, res) => {
    const name = req.params.name;
    const model = await store.readModel(name);
    if (!model) throw new DiagramError('NOT_FOUND', `No architecture model for "${name}".`);
    res.json({ model, layout: await store.readLayout(name) });
  });

  router.put('/:name/layout', async (req, res) => {
    await store.writeLayout(req.params.name, req.body);
    res.json({ ok: true });
  });

  router.delete('/:name/layout', async (req, res) => {
    await store.removeLayout(req.params.name);
    res.status(204).end();
  });

  return router;
}
