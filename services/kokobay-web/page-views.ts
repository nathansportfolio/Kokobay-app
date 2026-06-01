import { resolveKokobayApiBaseUrl } from './api-config';
import { fetchWithTimeout } from '@/utils/fetch-with-timeout';

const PAGE_VIEW_TIMEOUT_MS = 5_000;

/**
 * Best-effort product view ping for signed-in shoppers. Never throws; failures are ignored.
 */
export function recordProductPageView(email: string, itemHandle: string): void {
  const trimmedEmail = email.trim();
  const item = itemHandle.trim();
  if (!trimmedEmail || !item) return;

  const root = resolveKokobayApiBaseUrl();
  if (!root) return;

  const url = `${root}/api/page-views`;
  const body = JSON.stringify({ email: trimmedEmail, item });

  void fetchWithTimeout(
    url,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body,
    },
    PAGE_VIEW_TIMEOUT_MS,
  ).catch(() => {
    // Silent — analytics must not affect UX
  });
}
