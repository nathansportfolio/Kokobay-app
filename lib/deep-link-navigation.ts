import type { Href } from 'expo-router';
import { InteractionManager } from 'react-native';

import { deepLinkTargetHref, hrefToLogString, type ResolveDeepLinkResult } from '@/lib/deep-link-router';

export type AppLinkNavigate = (
  href: Href,
  options?: { replace?: boolean },
) => void;

export type AppLinkNavigationSource = 'cold_start' | 'url_event' | 'notification_tap';

const handledUrls = new Set<string>();
let navigationReady = false;
let pendingNavigation: {
  navigate: AppLinkNavigate;
  href: Href;
  options?: { replace?: boolean; source?: AppLinkNavigationSource };
} | null = null;

export function setAppLinkNavigationReady(ready: boolean): void {
  navigationReady = ready;
  if (ready) {
    flushPendingAppLinkNavigation();
  }
}

export function wasAppLinkHandled(url: string): boolean {
  return handledUrls.has(url.trim());
}

export function markAppLinkHandled(url: string): void {
  handledUrls.add(url.trim());
}

function flushPendingAppLinkNavigation(): void {
  if (!navigationReady || !pendingNavigation) return;
  const pending = pendingNavigation;
  pendingNavigation = null;
  scheduleAppLinkNavigation(pending.navigate, pending.href, pending.options);
}

export function scheduleAppLinkNavigation(
  navigate: AppLinkNavigate,
  href: Href,
  options?: { replace?: boolean; source?: AppLinkNavigationSource },
): void {
  const run = () => {
    try {
      navigate(href, { replace: options?.replace });
    } catch {
      // Navigation errors are non-fatal for deep links.
    }
  };

  const delayMs = options?.source === 'cold_start' ? 450 : 0;
  if (delayMs > 0) {
    InteractionManager.runAfterInteractions(() => {
      setTimeout(run, delayMs);
    });
    return;
  }

  InteractionManager.runAfterInteractions(run);
}

export function navigateFromResolvedDeepLink(
  navigate: AppLinkNavigate,
  resolved: ResolveDeepLinkResult,
  options: { source: AppLinkNavigationSource; url: string; replaceOnColdStart?: boolean },
): boolean {
  const target = deepLinkTargetHref(resolved);
  if (resolved.kind === 'unhandled' && !resolved.href) {
    return false;
  }

  const replace = options.source === 'cold_start' && (options.replaceOnColdStart ?? true);

  if (!navigationReady) {
    pendingNavigation = { navigate, href: target, options: { replace, source: options.source } };
    return true;
  }

  scheduleAppLinkNavigation(navigate, target, { replace, source: options.source });
  return true;
}
