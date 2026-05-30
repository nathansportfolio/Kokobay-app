import { resolveKokobayApiBaseUrl } from './api-config';

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

  void (async () => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), PAGE_VIEW_TIMEOUT_MS);
    try {
      await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body,
        signal: controller.signal,
      });
    } catch {
      // Silent — analytics must not affect UX
    } finally {
      clearTimeout(timeoutId);
    }
  })();
}
