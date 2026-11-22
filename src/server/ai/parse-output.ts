import { AiError } from './ai-error.ts';

/** Parses CLI stdout as JSON, or throws a readable error. */
export function parseJsonOutput(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    throw new AiError('FAILED', 'The AI tool returned text that is not JSON.');
  }
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
