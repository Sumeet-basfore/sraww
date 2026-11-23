import { Router } from 'express';
import { z } from 'zod';
import { renderFormula } from '../math/render-formula.ts';

const renderBody = z.object({
  latex: z.string().min(1).max(500),
  fontSize: z.number().int().min(12).max(120).optional(),
});

/** Render a validated LaTeX formula to a standalone SVG. */
export function createMathRouter(): Router {
  const router = Router();

  router.post('/render', async (req, res) => {
    const { latex, fontSize } = renderBody.parse(req.body);
    res.json(await renderFormula(latex, fontSize ?? 20));
  });

  return router;
}
