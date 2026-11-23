import express, { Router } from 'express';
import { unzipSync } from 'fflate';
import { z } from 'zod';
import { MAX_OVERSIZED_METADATA_BYTES, MAX_UPLOAD_ZIP_BYTES } from '../../shared/project-rules.ts';
import { intakeError, readZip, validateOversizedFiles } from '../projects/intake.ts';
import { fetchRepoZip, parseGithubTarget, stripArchiveRoot } from '../projects/github.ts';
import type { ProjectStore } from '../projects/store.ts';

const uploadQuery = z.object({
  name: z.string().trim().min(1).max(80),
  consent: z.literal('yes'),
});
const githubBody = z.object({
  repo: z.string().min(3).max(201),
  ref: z.string().max(200).optional(),
  name: z.string().trim().min(1).max(80),
  consent: z.literal(true),
});

/** Uploaded code projects: list them, add one from a zip file, or delete one with its files. */
export function createProjectRouter(
  store: ProjectStore,
  { fetchRepo = fetchRepoZip }: { fetchRepo?: typeof fetchRepoZip } = {},
): Router {
  const router = Router();

  router.get('/', async (_req, res) => {
    res.json({ projects: await store.list() });
  });

  router.post('/github', async (req, res) => {
    const body = githubBody.safeParse(req.body);
    if (!body.success) {
      throw intakeError('Give the project a name and accept the privacy notice first.', 400);
    }
    const target = parseGithubTarget({ repo: body.data.repo, ref: body.data.ref });
    const bytes = await fetchRepo(target);
    const intake = readZip(bytes);
    const stripPath = stripArchiveRoot(intake.files.map((file) => file.path));
    intake.files = intake.files.flatMap((file) => {
      const filePath = stripPath(file.path);
      return filePath ? [{ ...file, path: filePath }] : [];
    });
    intake.excluded = intake.excluded.map((item) => ({
      ...item,
      path: stripPath(item.path) ?? item.path,
    }));
    if (intake.files.length === 0) {
      throw intakeError('No files were kept. Check the list of excluded files.', 422);
    }
    const manifest = await store.create({
      name: body.data.name,
      consentAt: new Date().toISOString(),
      intake,
      source: { kind: 'github', ...target },
    });
    res.status(201).json(manifest);
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
      const bytes = new Uint8Array(body);
      let oversized: ReturnType<typeof validateOversizedFiles> = [];
      const archivedPaths = new Set<string>();
      let companionEntries = 0;
      try {
        const metadata = unzipSync(bytes, {
          filter: (entry) => {
            if (entry.name === '.__sraww_oversized__.json') {
              companionEntries += 1;
              if (companionEntries > 1)
                throw intakeError('The oversized file list is invalid.', 400);
              if (entry.originalSize > MAX_OVERSIZED_METADATA_BYTES)
                throw intakeError('The oversized file list is invalid.', 400);
              return true;
            }
            if (!entry.name.endsWith('/')) archivedPaths.add(entry.name.replace(/\\/g, '/'));
            return false;
          },
        });
        const encoded = metadata['.__sraww_oversized__.json'];
        if (encoded)
          oversized = validateOversizedFiles(
            JSON.parse(new TextDecoder().decode(encoded)),
            archivedPaths,
          );
      } catch (err) {
        if ((err as { status?: number }).status) throw err;
        throw intakeError('The oversized file list is invalid.', 400);
      }
      const intake = readZip(bytes, oversized);
      if (intake.files.length === 0 && intake.excluded.length === 0) {
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
