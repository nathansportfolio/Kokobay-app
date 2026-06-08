import {
  extractCustomerSessionFromBody,
  extractCustomerSessionFromHeaders,
} from '@/services/kokobay-web/customer-session';
import { resolveSessionToken } from '@/services/kokobay-web/customer-auth-shared';

/** Resolve session JWT from response headers and JSON body. */
export function extractSessionTokenFromResponse(
  headers: Headers,
  body: Record<string, unknown> | null,
): string | null {
  return (
    extractCustomerSessionFromHeaders(headers) ??
    extractCustomerSessionFromBody(body) ??
    resolveSessionToken(body, null)
  );
}
