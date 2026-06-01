import * as Linking from 'expo-linking';
import { useRouter, type Href } from 'expo-router';
import { useEffect, useRef } from 'react';

import {
  markAppLinkHandled,
  navigateFromResolvedDeepLink,
  setAppLinkNavigationReady,
  wasAppLinkHandled,
  type AppLinkNavigate,
} from '@/lib/deep-link-navigation';
import { resolveDeepLinkUrl } from '@/lib/deep-link-router';

/**
 * Handles Google Ads / Universal Links / custom scheme URLs via Expo Linking.
 * Complements Expo Router `+native-intent` path rewriting and push notification routing.
 */
export function useAppDeepLinking(navigationReady = true): void {
  const router = useRouter();
  const initialHandled = useRef(false);

  useEffect(() => {
    setAppLinkNavigationReady(navigationReady);
    return () => setAppLinkNavigationReady(false);
  }, [navigationReady]);

  useEffect(() => {
    if (!navigationReady) return;

    const navigate: AppLinkNavigate = (href: Href, options) => {
      if (options?.replace) {
        router.replace(href);
      } else {
        router.push(href);
      }
    };

    const handleUrl = (url: string | null, source: 'cold_start' | 'url_event') => {
      if (!url?.trim()) return;
      const trimmed = url.trim();
      if (wasAppLinkHandled(trimmed)) return;

      const resolved = resolveDeepLinkUrl(trimmed);
      const handled = navigateFromResolvedDeepLink(navigate, resolved, {
        source,
        url: trimmed,
        replaceOnColdStart: true,
      });
      if (handled) {
        markAppLinkHandled(trimmed);
      }
    };

    if (!initialHandled.current) {
      initialHandled.current = true;
      void Linking.getInitialURL().then((initialUrl) => {
        handleUrl(initialUrl, 'cold_start');
      });
    }

    const subscription = Linking.addEventListener('url', ({ url }) => {
      handleUrl(url, 'url_event');
    });

    return () => {
      subscription.remove();
    };
  }, [navigationReady, router]);
}
