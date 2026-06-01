import { resolveKokobayApiBaseUrl } from '@/services/kokobay-web/api-config';
import { fetchWithTimeout } from '@/utils/fetch-with-timeout';
import { isKokobayWebProductsConfigured } from '@/services/kokobay-web/client';
import { buildKokobayCustomerAuthHeaders } from '@/services/kokobay-web/customer-session';

export type AccountDeletionRequestResult =
  | { ok: true; message: string }
  | { ok: false; error: string; code?: string };

const ERROR_MESSAGES: Record<string, string> = {
  unauthorized: 'Your session has expired. Please sign in again.',
  rate_limited: 'Too many requests. Please wait and try again later.',
  invalid_request: 'Could not delete your account. Please try again.',
  invalid_json: 'Could not delete your account. Please try again.',
  body_too_large: 'Could not delete your account. Please try again.',
  internal_error: 'Something went wrong. Please try again later.',
  shopify_failed:
    'We could not remove your store account. Please try again or contact support.',
};

function friendlyError(error: string, code?: string): string {
  if (code && ERROR_MESSAGES[code]) return ERROR_MESSAGES[code];
  return error.trim() || 'Something went wrong. Please try again.';
}

/** POST /api/account/delete-request — Bearer session; no CSRF on mobile. */
export async function submitAccountDeletionRequest(
  sessionToken?: string | null,
): Promise<AccountDeletionRequestResult> {
  if (!isKokobayWebProductsConfigured()) {
    return { ok: false, error: 'Account services are not configured.' };
  }

  const root = resolveKokobayApiBaseUrl();
  if (!root) {
    return { ok: false, error: 'Account services are not configured.' };
  }

  const headers = await buildKokobayCustomerAuthHeaders(sessionToken ?? undefined, {
    includeGuestCart: false,
  });
  headers['Content-Type'] = 'application/json';

  if (!headers.Authorization) {
    return { ok: false, error: 'Sign in to delete your account.', code: 'unauthorized' };
  }

  try {
    const res = await fetchWithTimeout(`${root}/api/account/delete-request`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ confirm: true }),
    });

    const text = await res.text();
    let data: Record<string, unknown> | null = null;
    try {
      data = JSON.parse(text) as Record<string, unknown>;
    } catch {
      return { ok: false, error: 'Unexpected response from the server.' };
    }

    if (res.ok && data?.ok === true) {
      const message =
        typeof data.message === 'string' && data.message.trim()
          ? data.message.trim()
          : 'Your account and personal data have been deleted.';
      return { ok: true, message };
    }

    const code = typeof data?.code === 'string' ? data.code : undefined;
    const error =
      typeof data?.error === 'string' ? data.error : res.status === 429 ? 'Too many requests' : 'Request failed';
    return { ok: false, error: friendlyError(error, code), code };
  } catch {
    return { ok: false, error: 'Network error. Check your connection and try again.' };
  }
}
