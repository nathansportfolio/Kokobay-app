import type { z } from 'zod';

import { cartIntegrationServer } from '../cart-test-runtime';
import type {
  ApiAnalyticsEvent,
  ApiHttpMethod,
  ApiRequestOptions,
  ApiSuccessResponse,
} from '@/src/core/api/types';

type RouteOpts = {
  guestIdOverride?: string;
  auth?: string;
  sessionOverride?: string;
};

function routeRequest(
  method: ApiHttpMethod,
  path: string,
  body?: unknown,
  opts: RouteOpts = {},
): ApiSuccessResponse<Record<string, unknown>> {
  const result = cartIntegrationServer.route(method, path, body, opts);
  const data = result.data;
  const sessionToken =
    typeof data.sessionToken === 'string' ? data.sessionToken : null;

  return {
    data,
    status: result.status,
    headers: new Headers(),
    sessionToken,
  };
}

export function registerApiAnalyticsListener(_listener: ((event: ApiAnalyticsEvent) => void) | null): void {}

export class ApiClient {
  get<TSchema extends z.ZodType>(
    path: string,
    options: ApiRequestOptions<TSchema> = {},
  ): Promise<ApiSuccessResponse<z.infer<TSchema>>> {
    return Promise.resolve(
      routeRequest('GET', path, undefined, options) as ApiSuccessResponse<z.infer<TSchema>>,
    );
  }

  post<TSchema extends z.ZodType>(
    path: string,
    body: unknown,
    options: ApiRequestOptions<TSchema> = {},
  ): Promise<ApiSuccessResponse<z.infer<TSchema>>> {
    return Promise.resolve(
      routeRequest('POST', path, body, options) as ApiSuccessResponse<z.infer<TSchema>>,
    );
  }

  patch<TSchema extends z.ZodType>(
    path: string,
    body: unknown,
    options: ApiRequestOptions<TSchema> = {},
  ): Promise<ApiSuccessResponse<z.infer<TSchema>>> {
    return Promise.resolve(
      routeRequest('PATCH', path, body, options) as ApiSuccessResponse<z.infer<TSchema>>,
    );
  }

  delete<TSchema extends z.ZodType>(
    path: string,
    options: ApiRequestOptions<TSchema> = {},
  ): Promise<ApiSuccessResponse<z.infer<TSchema>>> {
    return Promise.resolve(
      routeRequest('DELETE', path, options.body, options) as ApiSuccessResponse<z.infer<TSchema>>,
    );
  }
}

export const api = new ApiClient();
