import type { AuthSession, AuthUser } from '@/types/auth';

import { resolveKokobayApiBaseUrl } from './api-config';
import { isKokobayWebProductsConfigured } from './client';
import {
  buildKokobayCustomerAuthHeaders,
  extractCustomerSessionFromBody,
  extractCustomerSessionFromHeaders,
  persistCustomerSessionCookie,
  resolveCustomerSessionToken,
} from './customer-session';

export type KokobayCustomerJson = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string | null;
  acceptsMarketing?: boolean;
};

type KokobayAuthOk = {
  ok: true;
  customer: KokobayCustomerJson;
  sessionToken?: string;
};

type KokobayAuthErr = {
  ok: false;
  error: string;
  code?: string;
};

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
};

function friendlyError(error: string, code?: string): string {
  if (code && ERROR_MESSAGES[code]) return ERROR_MESSAGES[code];
  return error.trim() || 'Something went wrong. Please try again.';
}

function toAuthUser(customer: KokobayCustomerJson): AuthUser {
  return {
    id: customer.id,
    email: customer.email,
    firstName: customer.firstName ?? '',
    lastName: customer.lastName ?? '',
  };
}

function sessionFromCustomer(customer: KokobayCustomerJson, sessionToken: string): AuthSession {
  return {
    accessToken: sessionToken,
    user: toAuthUser(customer),
  };
}

function resolveSessionToken(
  data: Record<string, unknown> | null,
  sessionCookie: string | null,
): string | null {
  return (
    sessionCookie?.trim() ||
    extractCustomerSessionFromBody(data) ||
    null
  );
}

async function customerAuthFetch(
  method: 'GET' | 'POST',
  path: string,
  body?: Record<string, unknown>,
  sessionOverride?: string,
): Promise<{ data: Record<string, unknown> | null; sessionCookie: string | null }> {
  const root = resolveKokobayApiBaseUrl();
  if (!root) return { data: null, sessionCookie: null };

  const url = `${root}${path.startsWith('/') ? path : `/${path}`}`;
  const headers = await buildKokobayCustomerAuthHeaders(sessionOverride, { includeGuestCart: true });
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  try {
    const res = await fetch(url, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const sessionCookie = extractCustomerSessionFromHeaders(res.headers);
    const text = await res.text();
    let data: Record<string, unknown> | null = null;
    try {
      data = JSON.parse(text) as Record<string, unknown>;
    } catch {
      return { data: null, sessionCookie };
    }

    const sessionFromBody = extractCustomerSessionFromBody(data);
    const resolvedSession = sessionCookie ?? sessionFromBody;

    return { data, sessionCookie: resolvedSession };
  } catch {
    return { data: null, sessionCookie: null };
  }
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
  await customerAuthFetch('POST', '/api/customer/auth/logout');
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

export async function kokobayCustomerMe(): Promise<KokobayCustomerAuthResult | null> {
  if (!isKokobayWebProductsConfigured()) return null;
  const existing = await resolveCustomerSessionToken();
  if (!existing) return null;

  const { data, sessionCookie } = await customerAuthFetch('GET', '/api/customer/auth/me', undefined, existing);
  if (data?.ok === true && (data as KokobayAuthOk).customer) {
    const token = resolveSessionToken(data, sessionCookie) ?? existing;
    if (token !== existing) await persistCustomerSessionCookie(token);
    return { ok: true, session: sessionFromCustomer((data as KokobayAuthOk).customer, token) };
  }

  if ((data as KokobayAuthErr | null)?.code === 'unauthorized') {
    const refreshed = await customerAuthFetch('POST', '/api/customer/auth/refresh', undefined, existing);
    const refreshedToken = resolveSessionToken(refreshed.data, refreshed.sessionCookie) ?? refreshed.sessionCookie;
    if (refreshedToken) await persistCustomerSessionCookie(refreshedToken);
    if (refreshed.data?.ok === true) {
      const customer = (refreshed.data as KokobayAuthOk).customer;
      if (customer?.id) {
        const token = refreshedToken ?? existing;
        return { ok: true, session: sessionFromCustomer(customer, token) };
      }
      const retry = await customerAuthFetch('GET', '/api/customer/auth/me', undefined, refreshedToken ?? existing);
      if (retry.data?.ok === true && (retry.data as KokobayAuthOk).customer) {
        const token = resolveSessionToken(retry.data, retry.sessionCookie) ?? refreshedToken ?? existing;
        if (token) await persistCustomerSessionCookie(token);
        return {
          ok: true,
          session: sessionFromCustomer((retry.data as KokobayAuthOk).customer, token),
        };
      }
    }
    await persistCustomerSessionCookie(null);
    return null;
  }

  return null;
}
