import type { AuthSession, AuthUser } from '@/types/auth';

import {
  extractCustomerSessionFromBody,
} from './customer-session';

export type KokobayCustomerJson = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string | null;
  acceptsMarketing?: boolean;
};

export type KokobayAuthOk = {
  ok: true;
  customer: KokobayCustomerJson;
  sessionToken?: string;
};

export type KokobayAuthErr = {
  ok: false;
  error: string;
  code?: string;
};

/** Server codes that mean the stored session must be cleared — not a network flake. */
export const SESSION_INVALID_CODES = new Set([
  'unauthorized',
  'invalid_session',
  'session_expired',
  'expired',
]);

export function isSessionInvalidCode(code: string | undefined): boolean {
  return code != null && SESSION_INVALID_CODES.has(code);
}

export function toAuthUser(customer: KokobayCustomerJson): AuthUser {
  return {
    id: customer.id,
    email: customer.email,
    firstName: customer.firstName ?? '',
    lastName: customer.lastName ?? '',
    acceptsMarketing: customer.acceptsMarketing ?? null,
  };
}

export function sessionFromCustomer(customer: KokobayCustomerJson, sessionToken: string): AuthSession {
  return {
    accessToken: sessionToken,
    user: toAuthUser(customer),
  };
}

export function resolveSessionToken(
  data: Record<string, unknown> | null,
  sessionCookie: string | null,
): string | null {
  return sessionCookie?.trim() || extractCustomerSessionFromBody(data) || null;
}

/**
 * Classifies `/me` and `/refresh` HTTP responses for session restore.
 * Transport failures are handled separately — never call this for fetch throws.
 */
export function classifyHttpRestoreResponse(
  status: number,
  data: Record<string, unknown> | null,
  parseFailed: boolean,
):
  | { kind: 'session_invalid'; status: number; code?: string }
  | { kind: 'session_unknown'; reason: 'server'; status: number }
  | null {
  if (status >= 500) {
    return { kind: 'session_unknown', reason: 'server', status };
  }

  if (parseFailed) {
    return status === 401 || status === 403
      ? { kind: 'session_invalid', status }
      : { kind: 'session_unknown', reason: 'server', status };
  }

  const code = typeof data?.code === 'string' ? data.code : undefined;

  if (status === 401 || status === 403 || isSessionInvalidCode(code)) {
    return { kind: 'session_invalid', status, code };
  }

  if (data?.ok === true) {
    return null;
  }

  if (status >= 400 || (data && data.ok !== true)) {
    return { kind: 'session_unknown', reason: 'server', status };
  }

  return { kind: 'session_unknown', reason: 'server', status };
}
