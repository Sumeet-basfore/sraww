import type { z } from 'zod';
import type { AiProvider, GenerateOptions, ProviderHealth } from '../../src/server/ai/provider.ts';
import { outlineReplySchema } from '../../src/shared/learn.ts';

export interface GenerateCall {
  prompt: string;
  options?: GenerateOptions;
}

export interface FakeReplies {
  outline?: unknown;
  lesson?: unknown;
  /** Delays only the lesson answer, so tests can make two requests overlap. */
  lessonDelayMs?: number;
}

/**
 * A stand-in provider. It records each call and answers with the reply for that call's schema,
 * parsed the way the real CLI wrapper parses it.
 */
export function fakeProvider(replies: FakeReplies, calls: GenerateCall[] = []): AiProvider {
  return {
    id: 'claude',
    health: async (): Promise<ProviderHealth> => ({
      id: 'claude',
      installed: true,
      loggedIn: true,
      detail: 'fake',
    }),
    generate: async <T>(
      prompt: string,
      schema: z.ZodType<T>,
      options?: GenerateOptions,
    ): Promise<T> => {
      calls.push({ prompt, options });
      const isOutline = (schema as unknown) === outlineReplySchema;
      if (!isOutline && replies.lessonDelayMs) {
        await new Promise((resolve) => setTimeout(resolve, replies.lessonDelayMs));
      }
      return schema.parse(isOutline ? replies.outline : replies.lesson);
    },
  };
}
