import { Router } from 'express';
import type { LibraryStore } from '../storage/library-store.ts';

/** Reads and saves the Excalidraw library. Items are validated by the store before they are kept. */
export function createLibraryRouter(store: LibraryStore): Router {
  const router = Router();

  router.get('/', async (_req, res) => {
    res.json({ items: await store.read() });
  });

  router.put('/', async (req, res) => {
    const items = await store.write(req.body);
    res.json({ count: items.length });
  });

  return router;
}
