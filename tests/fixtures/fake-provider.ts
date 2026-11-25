import type { z } from 'zod';
import type { AiProvider, GenerateOptions, ProviderHealth } from '../../src/server/ai/provider.ts';
import { moduleQuizReplySchema, outlineReplySchema } from '../../src/shared/learn.ts';

export interface GenerateCall {
  prompt: string;
  options?: GenerateOptions;
}

export interface FakeReplies {
  outline?: unknown;
  lesson?: unknown;
  quiz?: unknown;
  /** Delays only the lesson answer, so tests can make two requests overlap. */
  lessonDelayMs?: number;
  /** Delays only quiz generation, so tests can verify concurrent requests share one call. */
  quizDelayMs?: number;
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
      const isQuiz = (schema as unknown) === moduleQuizReplySchema;
      if (isQuiz && replies.quizDelayMs) {
        await new Promise((resolve) => setTimeout(resolve, replies.quizDelayMs));
      } else if (!isOutline && !isQuiz && replies.lessonDelayMs) {
        await new Promise((resolve) => setTimeout(resolve, replies.lessonDelayMs));
      }
      const reply = isOutline ? replies.outline : isQuiz ? replies.quiz : replies.lesson;
      return schema.parse(reply);
    },
  };
}
