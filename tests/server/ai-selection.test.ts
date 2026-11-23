import { describe, expect, it } from 'vitest';
import { checkSelection } from '../../src/server/ai/selection.ts';
import type { ModelOption } from '../../src/shared/ai-account.ts';

const MODELS: ModelOption[] = [
  { id: 'fast', label: 'Fast', efforts: ['low', 'medium'], defaultEffort: null },
  { id: 'deep', label: 'Deep', efforts: ['low', 'high', 'max'], defaultEffort: 'low' },
];

describe('checkSelection', () => {
  it('accepts a listed model with one of its efforts', () => {
    expect(() => checkSelection({ model: 'deep', effort: 'high' }, MODELS)).not.toThrow();
  });

  it('accepts the CLI default when no model or effort is chosen', () => {
    expect(() => checkSelection({ model: null, effort: null }, MODELS)).not.toThrow();
  });

  it('accepts any listed effort when the model is the CLI default', () => {
    expect(() => checkSelection({ model: null, effort: 'max' }, MODELS)).not.toThrow();
  });

  it('rejects a model the tool does not offer', () => {
    expect(() => checkSelection({ model: 'unknown', effort: null }, MODELS)).toThrow(
      /not a model this tool offers/,
    );
  });

  it('rejects an effort the chosen model does not support', () => {
    expect(() => checkSelection({ model: 'fast', effort: 'max' }, MODELS)).toThrow(
      /not available for Fast/,
    );
  });

  it('returns a 400 status for the client to read', () => {
    try {
      checkSelection({ model: 'unknown', effort: null }, MODELS);
      expect.unreachable();
    } catch (err) {
      expect(err).toMatchObject({ status: 400, expose: true });
    }
  });
});

describe('model ids on the wire', () => {
  it('never accepts an id that could be read as a command-line option', async () => {
    const { modelIdSchema } = await import('../../src/shared/ai-account.ts');
    expect(modelIdSchema.safeParse('--dangerous').success).toBe(false);
    expect(modelIdSchema.safeParse('gpt-6.2-sol').success).toBe(true);
  });
});
