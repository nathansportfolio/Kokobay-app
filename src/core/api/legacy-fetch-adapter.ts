import { api } from './apiClient';
import { isApiError, legacyApiErrorBody } from './errorHandler';
import type { ApiHttpMethod, ApiRequestOptions } from './types';

export type LegacyApiOptions = Omit<ApiRequestOptions, 'optional' | 'body'>;

export type LegacyHttpResult = {
  data: Record<string, unknown> | null;
  status: number;
  sessionToken: string | null;
};

/** Optional GET — returns `null` on any failure (CMS, banners). */
export async function legacyApiGetOptional(
  path: string,
  options: LegacyApiOptions = {},
): Promise<Record<string, unknown> | null> {
  const response = await api.get(path, { ...options, optional: true });
  if (!response) return null;
  const data = response.data;
  if (data && typeof data === 'object' && !Array.isArray(data)) {
    return data as Record<string, unknown>;
  }
  return null;
}

/** Fire-and-forget POST — never throws. */
export function legacyApiPostFireAndForget(
  path: string,
  body: unknown,
  options: LegacyApiOptions = {},
): void {
  void api
    .post(path, body, {
      ...options,
      optional: true,
      retries: options.retries ?? 0,
      coalesce: false,
    })
    .catch(() => {});
}

/** GET/POST that preserves HTTP error bodies for legacy `{ ok: false }` envelopes. */
export async function legacyApiFetch(
  method: Extract<ApiHttpMethod, 'GET' | 'POST'>,
  path: string,
  options: LegacyApiOptions & { body?: unknown } = {},
): Promise<LegacyHttpResult> {
  const base = {
    ...options,
    coalesce: options.coalesce ?? false,
    retries: options.retries ?? 0,
  };

  try {
    const response =
      method === 'GET'
        ? await api.get(path, base)
        : await api.post(path, options.body, base);

    const data = response.data;
    const record =
      data && typeof data === 'object' && !Array.isArray(data)
        ? (data as Record<string, unknown>)
        : null;

    return {
      data: record,
      status: response.status,
      sessionToken: response.sessionToken,
    };
  } catch (error) {
    if (isApiError(error) && error.kind === 'http') {
      const data = legacyApiErrorBody(error);
      return { data, status: error.status ?? 0, sessionToken: null };
    }
    return { data: null, status: 0, sessionToken: null };
  }
}

export function legacyApiErrorStatus(error: unknown): number | undefined {
  if (isApiError(error) && error.kind === 'http') return error.status;
  return undefined;
}
