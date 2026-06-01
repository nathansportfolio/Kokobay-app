import { markAppLinkHandled } from '@/lib/deep-link-navigation';
import { deepLinkTargetHref, hrefToLogString, resolveDeepLinkUrl } from '@/lib/deep-link-router';

/**
 * Rewrites incoming Universal Links / App Links before Expo Router matches routes.
 * @see https://docs.expo.dev/router/advanced/native-intent/
 */
export function redirectSystemPath({
  path,
  initial,
}: {
  path: string;
  initial: boolean;
}): string {
  const input = path.trim();
  if (!input) return '/';

  markAppLinkHandled(input);

  const resolved = resolveDeepLinkUrl(input);
  const target = deepLinkTargetHref(resolved);
  markAppLinkHandled(hrefToLogString(target));

  if (__DEV__) {
    console.log('[deep-link] redirectSystemPath', {
      initial,
      input,
      kind: resolved.kind,
      reason: resolved.reason ?? null,
      output: hrefToLogString(target),
    });
  }

  if (typeof target === 'string') {
    return target;
  }

  const params = target.params ?
    `?${new URLSearchParams(target.params as Record<string, string>).toString()}`
  : '';
  return `${target.pathname ?? '/'}${params}`;
}
