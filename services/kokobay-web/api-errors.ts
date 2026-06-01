import { FetchTimeoutError, HttpResponseError } from '@/utils/fetch-with-timeout';

/** Thrown when a Koko Bay web API request fails (network, timeout, HTTP, parse). */
export class KokobayApiError extends Error {
  readonly cause?: unknown;

  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = 'KokobayApiError';
    this.cause = cause;
  }
}

export function toKokobayApiError(error: unknown, fallback = 'Network request failed'): KokobayApiError {
  if (error instanceof KokobayApiError) return error;
  if (error instanceof FetchTimeoutError) {
    return new KokobayApiError(error.message, error);
  }
  if (error instanceof HttpResponseError) {
    return new KokobayApiError(error.message, error);
  }
  if (error instanceof Error) {
    return new KokobayApiError(error.message || fallback, error);
  }
  return new KokobayApiError(fallback, error);
}
