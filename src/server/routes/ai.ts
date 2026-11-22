import { Router } from 'express';
import { z } from 'zod';
import { diagramGraphSchema, type DiagramGraph } from '../../shared/ai-schemas.ts';
import { buildGeneratePrompt } from '../ai/prompts.ts';
import { normalizeGraph } from '../ai/normalize-graph.ts';
import type { AiServices } from '../ai/services.ts';

const generateBody = z.object({
  prompt: z.string().trim().min(3).max(2000),
  provider: z.enum(['claude', 'codex']).optional(),
});

export function createAiRouter(services: AiServices): Router {
  const router = Router();

  router.get('/status', async (_req, res) => {
    const providers = await Promise.all(Object.values(services.providers).map((p) => p.health()));
    res.json({ defaultProvider: services.defaultProvider, providers });
  });

  router.post('/generate', async (req, res) => {
    const body = generateBody.parse(req.body);
    const providerId = body.provider ?? services.defaultProvider;
    const provider = services.providers[providerId];
    const raw = await provider.generate(buildGeneratePrompt(body.prompt), diagramGraphSchema);
    const graph: DiagramGraph = normalizeGraph(raw);
    res.json({ provider: providerId, graph });
  });

  return router;
}
