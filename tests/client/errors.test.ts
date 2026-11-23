// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { errorMessage } from '../../src/client/lib/errors.ts';

describe('errorMessage', () => {
  it('maps request timeouts to a readable message', () => {
    expect(errorMessage(new DOMException('The operation timed out.', 'TimeoutError'))).toBe(
      'The AI tools took too long to respond. Try again.',
    );
  });
});
