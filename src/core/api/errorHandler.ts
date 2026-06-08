import { FetchTimeoutError, HttpResponseError } from '@/utils/fetch-with-timeout';

import type { ApiErrorKind } from './types';

export class ApiError extends Error {
  readonly kind: ApiErrorKind;
  readonly status?: number;
  readonly code?: string;
  readonly url: string;
  readonly cause?: unknown;
  readonly body?: unknown;

  constructor(
    message: string,
    options: {
      kind: ApiErrorKind;
      url: string;
      status?: number;
      code?: string;
      cause?: unknown;
      body?: unknown;
    },
  ) {
    super(message);
    this.name = 'ApiError';
    this.kind = options.kind;
    this.url = options.url;
    this.status = options.status;
    this.code = options.code;
    this.cause = options.cause;
    this.body = options.body;
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

export function isRetryableApiError(error: unknown): boolean {
  if (!(error instanceof ApiError)) return false;
  if (error.kind === 'timeout' || error.kind === 'network') return true;
  if (error.kind === 'http' && error.status != null) {
    return error.status === 408 || error.status === 429 || error.status >= 500;
  }
  return false;
}

export function isAuthExpiredError(error: unknown): boolean {
  if (!(error instanceof ApiError) || error.kind !== 'http') return false;
  if (error.status === 401 || error.status === 403) return true;
  const code = error.code?.toLowerCase();
  return (
    code === 'unauthorized' ||
    code === 'invalid_session' ||
    code === 'session_expired' ||
    code === 'expired'
  );
}

export function apiErrorFromUnknown(
  error: unknown,
  url: string,
  fallback = 'Network request failed',
): ApiError {
  if (error instanceof ApiError) return error;

  if (error instanceof FetchTimeoutError) {
    return new ApiError(error.message, { kind: 'timeout', url, cause: error });
  }

  if (error instanceof HttpResponseError) {
    return new ApiError(error.message, {
      kind: 'http',
      url: error.url || url,
      status: error.status,
      cause: error,
    });
  }

  if (error instanceof DOMException && error.name === 'AbortError') {
    return new ApiError('Request cancelled', { kind: 'cancelled', url, cause: error });
  }

  if (error instanceof TypeError) {
    return new ApiError(error.message || fallback, { kind: 'network', url, cause: error });
  }

  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    if (message.includes('network request failed') || message.includes('failed to fetch')) {
      return new ApiError(error.message, { kind: 'network', url, cause: error });
    }
    return new ApiError(error.message || fallback, { kind: 'network', url, cause: error });
  }

  return new ApiError(fallback, { kind: 'network', url, cause: error });
}

export function apiErrorFromHttpResponse(
  url: string,
  status: number,
  body: unknown,
  message?: string,
): ApiError {
  const record = body && typeof body === 'object' && !Array.isArray(body) ? (body as Record<string, unknown>) : null;
  const serverError = typeof record?.error === 'string' ? record.error : undefined;
  const serverCode = typeof record?.code === 'string' ? record.code : undefined;

  return new ApiError(message ?? serverError ?? `HTTP ${status}`, {
    kind: 'http',
    url,
    status,
    code: serverCode,
    body,
  });
}

export function apiErrorFromValidation(url: string, cause: unknown): ApiError {
  const message = cause instanceof Error ? cause.message : 'Response validation failed';
  return new ApiError(message, { kind: 'validation', url, cause });
}

export function apiErrorFromParse(url: string, cause?: unknown): ApiError {
  return new ApiError('Invalid JSON response', { kind: 'parse', url, cause });
}

export function apiErrorFromConfiguration(message: string): ApiError {
  return new ApiError(message, { kind: 'configuration', url: '' });
}

export function legacyApiErrorBody(error: unknown): Record<string, unknown> | null {
  if (!isApiError(error) || error.kind !== 'http' || !error.body) return null;
  if (typeof error.body === 'object' && !Array.isArray(error.body)) {
    return error.body as Record<string, unknown>;
  }
  return null;
}

/** Maps transport failures to session-restore semantics. */
export function legacyTransportReason(error: unknown): 'network' | 'timeout' | 'offline' {
  if (error instanceof FetchTimeoutError) return 'timeout';
  if (error instanceof ApiError) {
    if (error.kind === 'timeout') return 'timeout';
    if (error.kind === 'network') return 'network';
  }
  if (error instanceof TypeError) return 'network';
  const message = error instanceof Error ? error.message.toLowerCase() : '';
  if (message.includes('network request failed') || message.includes('failed to fetch')) {
    return 'offline';
  }
  return 'network';
}
