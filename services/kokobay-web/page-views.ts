import { legacyApiPostFireAndForget } from '@/src/core/api';

import { isKokobayApiConfigured } from './api-config';

const PAGE_VIEW_TIMEOUT_MS = 5_000;

/**
 * Best-effort product view ping for signed-in shoppers. Never throws; failures are ignored.
 */
export function recordProductPageView(email: string, itemHandle: string): void {
  const trimmedEmail = email.trim();
  const item = itemHandle.trim();
  if (!trimmedEmail || !item) return;

  if (!isKokobayApiConfigured()) return;

  legacyApiPostFireAndForget(
    '/api/page-views',
    { email: trimmedEmail, item },
    {
      auth: 'none',
      marketQuery: false,
      timeoutMs: PAGE_VIEW_TIMEOUT_MS,
    },
  );
}
