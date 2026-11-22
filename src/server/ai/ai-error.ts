export type AiErrorCode =
  'NOT_INSTALLED' | 'NOT_LOGGED_IN' | 'TIMEOUT' | 'OUTPUT_TOO_LARGE' | 'FAILED' | 'INVALID_OUTPUT';

/** An error from talking to a local AI CLI. The message is safe to show the user. */
export class AiError extends Error {
  constructor(
    readonly code: AiErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'AiError';
  }
}
