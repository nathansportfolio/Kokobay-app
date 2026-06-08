import type { z } from 'zod';

/** How customer / guest credentials are attached to a request. */
export type ApiAuthMode =
  | 'none'
  /** Guest cart cookie only (catalog, anonymous cart). */
  | 'guest-cart'
  /** Bearer + guest cart + session cookie when available. */
  | 'customer'
  /** In-memory session only — no persisted fallback (account-scoped APIs). */
  | 'active-customer';

export type ApiHttpMethod = 'GET' | 'POST' | 'PATCH' | 'DELETE';

export type ApiRequestOptions<TSchema extends z.ZodType = z.ZodTypeAny> = {
  signal?: AbortSignal;
  timeoutMs?: number;
  auth?: ApiAuthMode;
  /** Append `country` / `currency` query params (default true for GET). */
  marketQuery?: boolean;
  headers?: Record<string, string>;
  body?: unknown;
  /** Validate JSON body with Zod before returning. */
  schema?: TSchema;
  /** Max retry attempts for transient failures (default 2). */
  retries?: number;
  /** Return `null` instead of throwing on failure (optional CMS, banners). */
  optional?: boolean;
  /** Do not attempt `POST /api/customer/auth/refresh` + retry on 401. */
  skipAuthRefresh?: boolean;
  /** Dedupe identical in-flight GETs (default true for GET). */
  coalesce?: boolean;
  /** Override session token for this request (e.g. immediately after refresh). */
  sessionOverride?: string;
  /** Per-request guest cart id (cart sync uses a stable guest id per bag). */
  guestIdOverride?: string;
  /** Override guest-cart cookie attachment (default true for guest-cart / customer). */
  includeGuestCart?: boolean;
};

export type ApiSuccessResponse<T> = {
  data: T;
  status: number;
  headers: Headers;
  /** Resolved session token from Set-Cookie or JSON body, if any. */
  sessionToken: string | null;
};

export type ApiAnalyticsEvent = {
  method: ApiHttpMethod;
  path: string;
  url: string;
  status: number | null;
  durationMs: number;
  ok: boolean;
  errorKind?: ApiErrorKind;
  retried: boolean;
  authRefreshed: boolean;
};

export type ApiAuthLifecycle = {
  /** Called when refresh returns a new access token — update in-memory auth state. */
  onSessionRefreshed?: (accessToken: string) => void;
  /** Called when refresh fails with an invalid session — clear local auth. */
  onSessionInvalid?: () => void;
};

export type ApiErrorKind =
  | 'configuration'
  | 'cancelled'
  | 'network'
  | 'timeout'
  | 'http'
  | 'parse'
  | 'validation';
