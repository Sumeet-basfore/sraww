import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { AiError, type AiErrorCode } from './ai/ai-error.ts';
import { DiagramError, type DiagramCode } from './storage/diagram-store.ts';

const AI_STATUS: Record<AiErrorCode, number> = {
  NOT_INSTALLED: 503,
  NOT_LOGGED_IN: 503,
  TIMEOUT: 504,
  OUTPUT_TOO_LARGE: 502,
  FAILED: 502,
  INVALID_OUTPUT: 502,
};

const DIAGRAM_STATUS: Record<DiagramCode, number> = {
  INVALID_NAME: 400,
  INVALID_CONTENT: 400,
  NOT_FOUND: 404,
  EXISTS: 409,
};

/**
 * Turns every thrown error into a JSON response. Known errors keep their message;
 * anything unexpected is logged on the server and hidden from the client.
 */
export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (err instanceof DiagramError) {
    res.status(DIAGRAM_STATUS[err.code]).json({ error: err.message, code: err.code });
    return;
  }
  if (err instanceof AiError) {
    res.status(AI_STATUS[err.code]).json({ error: err.message, code: err.code });
    return;
  }
  if (err instanceof ZodError) {
    res.status(400).json({
      error: 'Invalid request.',
      issues: err.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
    });
    return;
  }
  const status = (err as { status?: unknown }).status;
  const expose = (err as { expose?: unknown }).expose;
  if (typeof status === 'number' && status >= 400 && status < 500 && expose === true) {
    res.status(status).json({ error: (err as Error).message });
    return;
  }
  console.error('Unexpected server error:', err);
  res.status(500).json({ error: 'Internal server error.' });
}
