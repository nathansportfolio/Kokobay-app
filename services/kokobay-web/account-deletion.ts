import { api, isApiError, legacyApiErrorBody } from '@/src/core/api';
import { isKokobayWebProductsConfigured } from '@/services/kokobay-web/client';

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

  if (!sessionToken?.trim()) {
    return { ok: false, error: 'Sign in to delete your account.', code: 'unauthorized' };
  }

  try {
    const response = await api.post(
      '/api/account/delete-request',
      { confirm: true },
      {
        auth: 'active-customer',
        sessionOverride: sessionToken,
        includeGuestCart: false,
        marketQuery: false,
        retries: 0,
        coalesce: false,
      },
    );

    const data = response.data as Record<string, unknown>;
    if (data?.ok === true) {
      const message =
        typeof data.message === 'string' && data.message.trim()
          ? data.message.trim()
          : 'Your account and personal data have been deleted.';
      return { ok: true, message };
    }

    const code = typeof data?.code === 'string' ? data.code : undefined;
    const error = typeof data?.error === 'string' ? data.error : 'Request failed';
    return { ok: false, error: friendlyError(error, code), code };
  } catch (error) {
    if (isApiError(error) && error.kind === 'http') {
      const data = legacyApiErrorBody(error);
      const code = typeof data?.code === 'string' ? data.code : undefined;
      const message =
        typeof data?.error === 'string'
          ? data.error
          : error.status === 429
            ? 'Too many requests'
            : 'Request failed';
      return { ok: false, error: friendlyError(message, code), code };
    }
    return { ok: false, error: 'Network error. Check your connection and try again.' };
  }
}
