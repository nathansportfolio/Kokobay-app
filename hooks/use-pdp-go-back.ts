import { useRouter, useLocalSearchParams, type Href } from 'expo-router';
import { useCallback } from 'react';

import { COLLECTIONS_TAB_HREF } from '@/utils/collection-navigation';
import { shouldFollowProductReturnTo } from '@/utils/product-navigation';

/**
 * PDP back — prefer stack pop so PLP scroll position and list state are preserved.
 * Falls back to `returnTo` navigation only when there is no history (deep links).
 */
export function usePdpGoBack() {
  const router = useRouter();
  const { returnTo } = useLocalSearchParams<{ returnTo?: string }>();

  return useCallback(() => {
    if (router.canGoBack()) {
      router.back();
      return;
    }

    const target = typeof returnTo === 'string' ? returnTo.trim() : '';
    if (shouldFollowProductReturnTo(target)) {
      router.navigate(target as Href);
      return;
    }

    router.navigate(COLLECTIONS_TAB_HREF);
  }, [router, returnTo]);
}
