import type { AuthSession } from '@/types/auth';

import { legacyApiFetch } from '@/src/core/api';

import { isKokobayWebProductsConfigured } from './client';
import { persistCustomerSessionCookie } from './customer-session';
import type { KokobayAuthErr, KokobayAuthOk } from './customer-auth-shared';
import {
  resolveSessionToken,
  sessionFromCustomer,
} from './customer-auth-shared';

export type { KokobayCustomerJson } from './customer-auth-shared';
export { kokobayCustomerMe, type KokobayCustomerMeResult } from './customer-auth-restore';

type KokobayMessageOk = {
  ok: true;
  message?: string;
};

export type KokobayCustomerAuthResult =
  | { ok: true; session: AuthSession }
  | { ok: false; error: string; code?: string };

const ERROR_MESSAGES: Record<string, string> = {
  invalid_credentials: 'Invalid email or password.',
  invalid_email: 'Please enter a valid email address.',
  weak_password: 'Please choose a stronger password and try again.',
  unauthorized: 'Your session has expired. Please sign in again.',
  rate_limited: 'Too many attempts. Please wait a moment and try again.',
  duplicate: 'An account with this email already exists.',
  email_taken: 'An account with this email already exists.',
  account_exists: 'An account with this email already exists.',
};

function friendlyError(error: string, code?: string): string {
  if (code && ERROR_MESSAGES[code]) return ERROR_MESSAGES[code];
  return error.trim() || 'Something went wrong. Please try again.';
}

const AUTH_FLOW_REQUEST_OPTS = {
  auth: 'none' as const,
  marketQuery: false,
  skipAuthRefresh: true,
  retries: 0,
  coalesce: false,
};

const AUTH_SESSION_REQUEST_OPTS = {
  auth: 'customer' as const,
  marketQuery: false,
  skipAuthRefresh: true,
  retries: 0,
  coalesce: false,
};

/** Login/signup/logout — preserves `{ ok: false }` bodies from 4xx responses. */
async function customerAuthFetch(
  method: 'GET' | 'POST',
  path: string,
  body?: Record<string, unknown>,
  options: { useSession?: boolean; sessionOverride?: string } = {},
): Promise<{ data: Record<string, unknown> | null; sessionCookie: string | null }> {
  const requestOpts = options.useSession ? AUTH_SESSION_REQUEST_OPTS : AUTH_FLOW_REQUEST_OPTS;
  const result = await legacyApiFetch(method, path, {
    ...requestOpts,
    sessionOverride: options.sessionOverride,
    body,
  });

  return { data: result.data, sessionCookie: result.sessionToken };
}

function parseAuthSuccess(
  data: Record<string, unknown> | null,
  sessionCookie: string | null,
): KokobayCustomerAuthResult {
  if (!data || data.ok !== true) {
    const err = data as KokobayAuthErr | null;
    return {
      ok: false,
      error: friendlyError(typeof err?.error === 'string' ? err.error : 'Request failed.', err?.code),
      code: typeof err?.code === 'string' ? err.code : undefined,
    };
  }
  const customer = (data as KokobayAuthOk).customer;
  if (!customer?.id || !customer.email) {
    return { ok: false, error: 'Unexpected response from the server.' };
  }
  const sessionToken = resolveSessionToken(data, sessionCookie);
  if (!sessionToken) {
    return {
      ok: false,
      error: 'Could not establish a session. Please try again.',
    };
  }
  return { ok: true, session: sessionFromCustomer(customer, sessionToken) };
}

export async function kokobayCustomerLogin(
  email: string,
  password: string,
): Promise<KokobayCustomerAuthResult> {
  if (!isKokobayWebProductsConfigured()) {
    return { ok: false, error: 'Sign-in is not configured.' };
  }
  const { data, sessionCookie } = await customerAuthFetch('POST', '/api/customer/auth/login', {
    email: email.trim(),
    password,
  });
  const result = parseAuthSuccess(data, sessionCookie);
  if (result.ok) {
    await persistCustomerSessionCookie(result.session.accessToken);
  }
  return result;
}

export async function kokobayCustomerSignup(input: {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  acceptsMarketing?: boolean;
}): Promise<KokobayCustomerAuthResult> {
  if (!isKokobayWebProductsConfigured()) {
    return { ok: false, error: 'Registration is not configured.' };
  }
  const { data, sessionCookie } = await customerAuthFetch('POST', '/api/customer/auth/signup', {
    email: input.email.trim(),
    password: input.password,
    firstName: input.firstName.trim(),
    lastName: input.lastName.trim(),
    ...(input.acceptsMarketing !== undefined ? { acceptsMarketing: input.acceptsMarketing } : {}),
  });
  const result = parseAuthSuccess(data, sessionCookie);
  if (result.ok) {
    await persistCustomerSessionCookie(result.session.accessToken);
  }
  return result;
}

export async function kokobayCustomerLogout(): Promise<void> {
  if (!isKokobayWebProductsConfigured()) return;
  await customerAuthFetch('POST', '/api/customer/auth/logout', undefined, { useSession: true });
  await persistCustomerSessionCookie(null);
}

export async function kokobayCustomerForgotPassword(email: string): Promise<
  | { ok: true; message: string }
  | { ok: false; error: string; code?: string }
> {
  if (!isKokobayWebProductsConfigured()) {
    return { ok: false, error: 'Password reset is not configured.' };
  }
  const { data } = await customerAuthFetch('POST', '/api/customer/auth/forgot-password', {
    email: email.trim(),
  });
  if (!data || data.ok !== true) {
    const err = data as KokobayAuthErr | null;
    return {
      ok: false,
      error: friendlyError(typeof err?.error === 'string' ? err.error : 'Request failed.', err?.code),
      code: typeof err?.code === 'string' ? err.code : undefined,
    };
  }
  const message =
    typeof (data as KokobayMessageOk).message === 'string'
      ? (data as KokobayMessageOk).message!
      : 'If an account exists for this email, a reset link has been sent.';
  return { ok: true, message };
}
