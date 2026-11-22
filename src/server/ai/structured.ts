import { z } from 'zod';
import { AiError } from './ai-error.ts';

export type Invoke = (prompt: string, jsonSchema: Record<string, unknown>) => Promise<unknown>;

/**
 * Strict structured-output modes (Codex) require every property to be listed as required.
 * This returns a copy with that rule applied to every object, recursively. Optional fields in our
 * schemas are nullish, so they become required-but-nullable.
 */
export function strictRequired(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(strictRequired);
  if (typeof node !== 'object' || node === null) return node;
  const copy: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(node)) {
    copy[key] =
      key === 'properties' && typeof value === 'object' && value !== null
        ? Object.fromEntries(Object.entries(value).map(([k, v]) => [k, strictRequired(v)]))
        : strictRequired(value);
  }
  if (copy.properties && typeof copy.properties === 'object') {
    copy.required = Object.keys(copy.properties);
  }
  return copy;
}

/**
 * JSON Schema for the CLI flags. Zod adds a $schema URL that the Claude CLI cannot resolve,
 * so it is removed; the answer is still checked by zod on our side.
 */
export function cliSafeSchema(schema: z.ZodType): Record<string, unknown> {
  const withoutMeta = Object.fromEntries(
    Object.entries(z.toJSONSchema(schema)).filter(([key]) => key !== '$schema'),
  );
  return strictRequired(withoutMeta) as Record<string, unknown>;
}

function summarize(error: z.ZodError): string {
  return error.issues
    .slice(0, 3)
    .map((issue) => `${issue.path.join('.') || 'root'}: ${issue.message}`)
    .join('; ')
    .slice(0, 300);
}

/**
 * Asks a CLI for JSON matching `schema`, then validates the answer ourselves.
 * One retry carries the validation problem back to the model; a second failure is an error.
 */
export async function generateStructured<T>(
  invoke: Invoke,
  prompt: string,
  schema: z.ZodType<T>,
): Promise<T> {
  const jsonSchema = cliSafeSchema(schema);

  const first = schema.safeParse(await invoke(prompt, jsonSchema));
  if (first.success) return first.data;

  const retryPrompt = `${prompt}\n\nYour previous answer did not match the required JSON format (${summarize(first.error)}). Answer again with only the JSON object.`;
  const second = schema.safeParse(await invoke(retryPrompt, jsonSchema));
  if (second.success) return second.data;

  throw new AiError(
    'INVALID_OUTPUT',
    'The AI tool did not return a usable diagram. Try rephrasing the request.',
  );
}
