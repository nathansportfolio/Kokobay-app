import { api, isApiError, jsonAnySchema } from '@/src/core/api';

import { KokobayApiError, toKokobayApiError } from './api-errors';
import {
  isKokobayApiConfigured,
  kokobayApiEnvDebug,
} from './api-config';

/** True when a Koko Bay API base URL resolves (production or local target). */
export function isKokobayWebProductsConfigured(): boolean {
  return isKokobayApiConfigured();
}

/** @deprecated Use {@link kokobayApiEnvDebug} from `./api-config`. */
export function kokobayWebEnvDebug(): ReturnType<typeof kokobayApiEnvDebug> {
  return kokobayApiEnvDebug();
}

type Json = Record<string, unknown>;

function asJsonRecord(parsed: unknown): Json {
  if (parsed === null || typeof parsed !== 'object') {
    throw new KokobayApiError('Invalid JSON response');
  }
  if (Array.isArray(parsed)) {
    return parsed as unknown as Json;
  }
  return parsed as Json;
}

/** `GET` JSON from the Koko Bay web API. Throws {@link KokobayApiError} on failure. */
export async function fetchKokobayJson(
  path: string,
  init?: { signal?: AbortSignal },
): Promise<Json> {
  try {
    const response = await api.get(path, {
      auth: 'none',
      marketQuery: true,
      signal: init?.signal,
      coalesce: false,
      schema: jsonAnySchema,
    });

    return asJsonRecord(response.data);
  } catch (error) {
    if (__DEV__) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn('[KOKOBAY API] fetch failed', { path, message });
    }
    if (isApiError(error)) {
      throw toKokobayApiError(error);
    }
    throw toKokobayApiError(error);
  }
}

/** Same as {@link fetchKokobayJson} but returns `null` on failure (banners, optional CMS). */
export async function tryFetchKokobayJson(
  path: string,
  init?: { signal?: AbortSignal },
): Promise<Json | null> {
  try {
    return await fetchKokobayJson(path, init);
  } catch {
    return null;
  }
}

/** `GET /api/collections` → `{ collections: KokobayCollectionJson[] }` */
export async function fetchKokobayCollectionsJson(): Promise<Json | null> {
  return tryFetchKokobayJson('/api/collections');
}

export { KokobayApiError } from './api-errors';
