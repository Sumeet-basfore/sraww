import type { Request, Response } from 'express';
import { Router } from 'express';
import { z } from 'zod';
import {
  defaultProviderBodySchema,
  loginCodeBodySchema,
  providerIdSchema,
  PROVIDER_IDS,
  selectionSchema,
  type ProviderId,
  type ProvidersView,
} from '../../shared/ai-account.ts';
import type { AiServices } from '../ai/services.ts';
import { checkSelection } from '../ai/selection.ts';

const providerParam = z.object({ id: providerIdSchema });

function providerOf(req: Request): ProviderId {
  return providerParam.parse({ id: req.params.id }).id;
}

/** Account, model and sign-in endpoints for the AI settings page. */
export function createAiAccountRouter(services: AiServices): Router {
  const router = Router();

  router.get('/providers', async (_req, res) => {
    const providers = await Promise.all(PROVIDER_IDS.map((id) => services.accounts[id].view()));
    const body: ProvidersView = { defaultProvider: services.currentDefault(), providers };
    res.json(body);
  });

  router.put('/default', async (req, res) => {
    const { provider } = defaultProviderBodySchema.parse(req.body);
    await services.settings.setDefault(provider);
    res.json({ defaultProvider: services.currentDefault() });
  });

  router.put('/providers/:id/selection', async (req, res) => {
    const id = providerOf(req);
    const selection = selectionSchema.parse(req.body);
    checkSelection(selection, await services.accounts[id].models());
    await services.settings.setSelection(id, selection);
    res.json(await services.accounts[id].view());
  });

  router.get('/providers/:id/login', (req, res) => {
    sendLogin(res, services.accounts[providerOf(req)].currentLogin());
  });

  router.post('/providers/:id/login', async (req, res) => {
    const flow = await services.accounts[providerOf(req)].startLogin();
    sendLogin(res, flow);
  });

  router.post('/providers/:id/login/code', async (req, res) => {
    const { code } = loginCodeBodySchema.parse(req.body);
    const flow = await services.accounts[providerOf(req)].submitLoginCode(code);
    sendLogin(res, flow);
  });

  router.delete('/providers/:id/login', async (req, res) => {
    const flow = await services.accounts[providerOf(req)].cancelLogin();
    sendLogin(res, flow);
  });

  return router;
}

function sendLogin(res: Response, flow: unknown): void {
  res.json({ login: flow });
}
