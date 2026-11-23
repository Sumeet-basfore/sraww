import express, { Router } from 'express';
import { z } from 'zod';
import { MAX_UPLOAD_ZIP_BYTES } from '../../shared/project-rules.ts';
import { intakeError, readZip } from '../projects/intake.ts';
import type { ProjectStore } from '../projects/store.ts';

const uploadQuery = z.object({
  name: z.string().trim().min(1).max(80),
  consent: z.literal('yes'),
});

/** Uploaded code projects: list them, add one from a zip file, or delete one with its files. */
export function createProjectRouter(store: ProjectStore): Router {
  const router = Router();

  router.get('/', async (_req, res) => {
    res.json({ projects: await store.list() });
  });

  router.post(
    '/',
    express.raw({
      type: ['application/zip', 'application/octet-stream'],
      limit: MAX_UPLOAD_ZIP_BYTES,
    }),
    async (req, res) => {
      const query = uploadQuery.safeParse(req.query);
      if (!query.success) {
        throw intakeError('Give the project a name and accept the privacy notice first.', 400);
      }
      const body = req.body as unknown;
      if (!Buffer.isBuffer(body) || body.length === 0) {
        throw intakeError('Send the project as a zip file.', 400);
      }
      const intake = readZip(new Uint8Array(body));
      if (intake.files.length === 0) {
        throw intakeError('No files were kept. Check the list of excluded files.', 422);
      }
      const manifest = await store.create({
        name: query.data.name,
        consentAt: new Date().toISOString(),
        intake,
      });
      res.status(201).json(manifest);
    },
  );

  router.delete('/:id', async (req, res) => {
    await store.remove(req.params.id);
    res.status(204).end();
  });

  return router;
}
