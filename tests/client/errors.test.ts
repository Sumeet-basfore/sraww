// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { errorMessage } from '../../src/client/lib/errors.ts';

describe('errorMessage', () => {
  it('maps request timeouts to a readable message', () => {
    expect(errorMessage(new DOMException('The operation timed out.', 'TimeoutError'))).toBe(
      'The AI tools took too long to respond. Try again.',
    );
  });

  it('says the local server could not be reached when the browser cannot send a request', () => {
    expect(errorMessage(new TypeError('Failed to fetch'))).toBe(
      'Could not reach sraww. Check that the local server is running, then try again.',
    );
  });

  it('keeps the message of any other error', () => {
    expect(errorMessage(new TypeError('Cannot read properties of undefined'))).toBe(
      'Cannot read properties of undefined',
    );
  });
});
