import type { z } from 'zod';

import { fetchWithTimeout } from '@/utils/fetch-with-timeout';

import { refreshAuthSession } from '@/src/core/auth/refresh-customer-session';

import {
  buildApiUrl,
  buildRequestAuthHeaders,
  mergeRequestHeaders,
  shouldAttemptAuthRefresh,
} from './authInterceptor';
import { extractSessionTokenFromResponse } from './session-token';
import {
  ApiError,
  apiErrorFromHttpResponse,
  apiErrorFromParse,
  apiErrorFromUnknown,
  apiErrorFromValidation,
  isRetryableApiError,
} from './errorHandler';
import { requestQueue } from './requestQueue';
import { jsonRecordSchema, parseWithSchema } from './schemas';
import type {
  ApiAnalyticsEvent,
  ApiHttpMethod,
  ApiRequestOptions,
  ApiSuccessResponse,
} from './types';

type AnalyticsListener = (event: ApiAnalyticsEvent) => void;

const DEFAULT_RETRIES = 2;

let analyticsListener: AnalyticsListener | null = null;

export function registerApiAnalyticsListener(listener: AnalyticsListener | null): void {
  analyticsListener = listener;
}

function emitAnalytics(event: ApiAnalyticsEvent): void {
  analyticsListener?.(event);
  if (__DEV__) {
    const tag = event.ok ? 'ok' : event.errorKind ?? 'error';
    console.log(`[API] ${event.method} ${event.path} → ${event.status ?? '—'} (${event.durationMs}ms) ${tag}`);
  }
}

function defaultMarketQuery(method: ApiHttpMethod): boolean {
  return method === 'GET';
}

function coalesceKey(method: ApiHttpMethod, path: string, auth: string, sessionOverride?: string): string {
  return `${method}:${path}:${auth}:${sessionOverride ?? ''}`;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function retryDelayMs(attempt: number): number {
  return Math.min(250 * 2 ** attempt, 2_000);
}

async function readResponseBody(res: Response): Promise<{ parsed: unknown; text: string }> {
  const text = await res.text();
  if (!text.trim()) return { parsed: null, text };

  try {
    return { parsed: JSON.parse(text) as unknown, text };
  } catch (error) {
    throw apiErrorFromParse(res.url, error);
  }
}

class ApiClient {
  async get<TSchema extends z.ZodType = typeof jsonRecordSchema>(
    path: string,
    options: ApiRequestOptions<TSchema> & { optional: true },
  ): Promise<ApiSuccessResponse<z.infer<TSchema>> | null>;
  async get<TSchema extends z.ZodType = typeof jsonRecordSchema>(
    path: string,
    options?: ApiRequestOptions<TSchema>,
  ): Promise<ApiSuccessResponse<z.infer<TSchema>>>;
  async get<TSchema extends z.ZodType = typeof jsonRecordSchema>(
    path: string,
    options: ApiRequestOptions<TSchema> = {},
  ): Promise<ApiSuccessResponse<z.infer<TSchema>> | null> {
    return this.request('GET', path, options);
  }

  async post<TSchema extends z.ZodType = typeof jsonRecordSchema>(
    path: string,
    body: unknown,
    options: ApiRequestOptions<TSchema> & { optional: true },
  ): Promise<ApiSuccessResponse<z.infer<TSchema>> | null>;
  async post<TSchema extends z.ZodType = typeof jsonRecordSchema>(
    path: string,
    body?: unknown,
    options?: ApiRequestOptions<TSchema>,
  ): Promise<ApiSuccessResponse<z.infer<TSchema>>>;
  async post<TSchema extends z.ZodType = typeof jsonRecordSchema>(
    path: string,
    body?: unknown,
    options: ApiRequestOptions<TSchema> = {},
  ): Promise<ApiSuccessResponse<z.infer<TSchema>> | null> {
    return this.request('POST', path, { ...options, body });
  }

  async patch<TSchema extends z.ZodType = typeof jsonRecordSchema>(
    path: string,
    body: unknown,
    options: ApiRequestOptions<TSchema> & { optional: true },
  ): Promise<ApiSuccessResponse<z.infer<TSchema>> | null>;
  async patch<TSchema extends z.ZodType = typeof jsonRecordSchema>(
    path: string,
    body?: unknown,
    options?: ApiRequestOptions<TSchema>,
  ): Promise<ApiSuccessResponse<z.infer<TSchema>>>;
  async patch<TSchema extends z.ZodType = typeof jsonRecordSchema>(
    path: string,
    body?: unknown,
    options: ApiRequestOptions<TSchema> = {},
  ): Promise<ApiSuccessResponse<z.infer<TSchema>> | null> {
    return this.request('PATCH', path, { ...options, body });
  }

  async delete<TSchema extends z.ZodType = typeof jsonRecordSchema>(
    path: string,
    options: ApiRequestOptions<TSchema> & { optional: true },
  ): Promise<ApiSuccessResponse<z.infer<TSchema>> | null>;
  async delete<TSchema extends z.ZodType = typeof jsonRecordSchema>(
    path: string,
    options?: ApiRequestOptions<TSchema>,
  ): Promise<ApiSuccessResponse<z.infer<TSchema>>>;
  async delete<TSchema extends z.ZodType = typeof jsonRecordSchema>(
    path: string,
    options: ApiRequestOptions<TSchema> = {},
  ): Promise<ApiSuccessResponse<z.infer<TSchema>> | null> {
    return this.request('DELETE', path, options);
  }

  private async request<TSchema extends z.ZodType>(
    method: ApiHttpMethod,
    path: string,
    options: ApiRequestOptions<TSchema>,
  ): Promise<ApiSuccessResponse<z.infer<TSchema>> | null> {
    const auth = options.auth ?? (method === 'GET' ? 'guest-cart' : 'customer');
    const marketQuery = options.marketQuery ?? defaultMarketQuery(method);
    const retries = options.retries ?? DEFAULT_RETRIES;
    const schema = (options.schema ?? jsonRecordSchema) as TSchema;
    const shouldCoalesce = options.coalesce ?? method === 'GET';

    const run = () =>
      this.executeRequest(method, path, {
        ...options,
        auth,
        marketQuery,
        retries,
        schema,
      });

    if (!shouldCoalesce) return run();

    const key = coalesceKey(method, path, auth, options.sessionOverride);
    return requestQueue.coalesce(key, run);
  }

  private async executeRequest<TSchema extends z.ZodType>(
    method: ApiHttpMethod,
    path: string,
    options: Required<Pick<ApiRequestOptions<TSchema>, 'auth' | 'marketQuery' | 'retries' | 'schema'>> &
      ApiRequestOptions<TSchema>,
  ): Promise<ApiSuccessResponse<z.infer<TSchema>> | null> {
    const startedAt = performance.now();
    let retried = false;
    let authRefreshed = false;
    let sessionOverride = options.sessionOverride;

    let url: string;
    try {
      url = buildApiUrl(path, options.marketQuery);
    } catch (error) {
      if (options.optional) return null;
      throw apiErrorFromUnknown(error, path);
    }

    for (let attempt = 0; attempt <= options.retries; attempt++) {
      if (attempt > 0) retried = true;

      try {
        const result = await this.fetchOnce(method, url, path, options, sessionOverride);
        emitAnalytics({
          method,
          path,
          url,
          status: result.status,
          durationMs: Math.round(performance.now() - startedAt),
          ok: true,
          retried,
          authRefreshed,
        });
        return result;
      } catch (error) {
        const apiError = apiErrorFromUnknown(error, url);

        if (
          !options.skipAuthRefresh &&
          !authRefreshed &&
          apiError instanceof ApiError &&
          apiError.kind === 'http' &&
          shouldAttemptAuthRefresh(
            options.auth,
            apiError.status ?? 0,
            apiError.body && typeof apiError.body === 'object' && !Array.isArray(apiError.body)
              ? (apiError.body as Record<string, unknown>)
              : null,
          )
        ) {
          const newToken = await refreshAuthSession();
          if (newToken) {
            authRefreshed = true;
            sessionOverride = newToken;
            continue;
          }
        }

        if (attempt < options.retries && isRetryableApiError(apiError)) {
          await sleep(retryDelayMs(attempt));
          continue;
        }

        emitAnalytics({
          method,
          path,
          url,
          status: apiError.status ?? null,
          durationMs: Math.round(performance.now() - startedAt),
          ok: false,
          errorKind: apiError.kind,
          retried,
          authRefreshed,
        });

        if (options.optional) return null;
        throw apiError;
      }
    }

    if (options.optional) return null;
    throw apiErrorFromUnknown(new Error('Request failed'), url);
  }

  private async fetchOnce<TSchema extends z.ZodType>(
    method: ApiHttpMethod,
    url: string,
    path: string,
    options: ApiRequestOptions<TSchema> & {
      auth: NonNullable<ApiRequestOptions<TSchema>['auth']>;
      schema: TSchema;
    },
    sessionOverride?: string,
  ): Promise<ApiSuccessResponse<z.infer<TSchema>>> {
    const authHeaders = await buildRequestAuthHeaders(options.auth, sessionOverride, {
      guestIdOverride: options.guestIdOverride,
      includeGuestCart: options.includeGuestCart,
    });
    const headers = mergeRequestHeaders(
      authHeaders,
      options.headers,
      method,
      options.body !== undefined,
    );

    const init: RequestInit = {
      method,
      headers,
      signal: options.signal,
    };

    if (options.body !== undefined && method !== 'GET') {
      init.body = JSON.stringify(options.body);
    }

    const res = await fetchWithTimeout(url, init, options.timeoutMs);
    const { parsed } = await readResponseBody(res);
    const record =
      parsed && typeof parsed === 'object' && !Array.isArray(parsed)
        ? (parsed as Record<string, unknown>)
        : null;

    if (!res.ok) {
      throw apiErrorFromHttpResponse(url, res.status, parsed);
    }

    const sessionToken = extractSessionTokenFromResponse(res.headers, record);

    try {
      const data = parseWithSchema(options.schema, parsed);
      return {
        data,
        status: res.status,
        headers: res.headers,
        sessionToken,
      };
    } catch (error) {
      throw apiErrorFromValidation(url, error);
    }
  }
}

export const api = new ApiClient();

export { ApiClient };
