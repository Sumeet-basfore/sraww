import { Router } from 'express';
import { z } from 'zod';
import { buildArchModel } from '../arch/build-model.ts';
import { collectSourceFiles, ScanError } from '../arch/collect-files.ts';
import { diffModels } from '../arch/diff.ts';
import type { ArchProject } from '../arch/projects.ts';
import { scanImports } from '../arch/scan-ts.ts';
import type { ArchStore } from '../storage/arch-store.ts';
import { DiagramError } from '../storage/diagram-store.ts';
import type { AiServices } from '../ai/services.ts';
import { applyNames, buildNamingPrompt, namingReplySchema } from '../arch/naming.ts';

export const MAX_SCAN_FILES = 5000;
export const SCAN_TIMEOUT_MS = 120_000;

const scanBody = z.object({
  projectId: z.string().min(1).max(100),
  name: z.string().min(1).max(200),
});

/** Architecture routes. Models and layouts are under /models; scanning reads only allowed projects. */
export function createArchRouter(
  store: ArchStore,
  projects: readonly ArchProject[],
  ai: AiServices,
): Router {
  const router = Router();

  router.get('/projects', (_req, res) => {
    res.json({ projects: projects.map(({ id, label }) => ({ id, label })) });
  });

  router.get('/models/:name', async (req, res) => {
    const name = req.params.name;
    const model = await store.readModel(name);
    if (!model) throw new DiagramError('NOT_FOUND', `No architecture model for "${name}".`);
    res.json({ model, layout: await store.readLayout(name) });
  });

  router.put('/models/:name/layout', async (req, res) => {
    await store.writeLayout(req.params.name, req.body);
    res.json({ ok: true });
  });

  router.delete('/models/:name/layout', async (req, res) => {
    await store.removeLayout(req.params.name);
    res.status(204).end();
  });

  router.post('/models/:name/name', async (req, res) => {
    const name = req.params.name;
    const model = await store.readModel(name);
    if (!model) throw new DiagramError('NOT_FOUND', `No architecture model for "${name}".`);
    const reply = await ai.providers[ai.currentDefault()].generate(
      buildNamingPrompt(model),
      namingReplySchema,
    );
    const named = applyNames(model, reply);
    const saved = await store.writeModel(name, named.model);
    res.json({ model: saved, applied: named.applied });
  });

  router.post('/scan', async (req, res) => {
    const body = scanBody.parse(req.body);
    const project = projects.find((p) => p.id === body.projectId);
    if (!project) throw new DiagramError('NOT_FOUND', 'Unknown project. Add it to ARCH_PROJECTS.');

    const files = await collectSourceFiles(project.root, MAX_SCAN_FILES);
    if (files.length === 0) {
      throw new ScanError(
        'NO_SOURCE_FILES',
        'No JavaScript or TypeScript files were found in this folder.',
      );
    }
    const edges = await scanImports(project.root, files, SCAN_TIMEOUT_MS);
    const previous = await store.readModel(body.name).catch(() => null);
    const model = buildArchModel({
      projectId: project.id,
      files,
      edges,
      sourceLabel: project.label,
      generatedAt: new Date().toISOString(),
    });
    const saved = await store.writeModel(body.name, model);
    res.json({
      model: saved,
      layout: await store.readLayout(body.name),
      diff: diffModels(previous, saved),
    });
  });

  return router;
}
