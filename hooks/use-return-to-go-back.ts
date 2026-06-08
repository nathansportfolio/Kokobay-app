import { useRouter, useLocalSearchParams, type Href } from 'expo-router';
import { useCallback } from 'react';

import { shouldFollowProductReturnTo } from '@/utils/product-navigation';

const DEFAULT_FALLBACK = '/(tabs)/categories' as Href;

/** Tab routes jump instead of stack — use `returnTo` only when there is nothing to pop. */
export function useReturnToGoBack(fallback: Href = DEFAULT_FALLBACK) {
  const router = useRouter();
  const { returnTo } = useLocalSearchParams<{ returnTo?: string }>();

  return useCallback(() => {
    const target = typeof returnTo === 'string' ? returnTo.trim() : '';

    if (shouldFollowProductReturnTo(target)) {
      router.navigate(target as Href);
      return;
    }

    if (router.canGoBack()) {
      router.back();
      return;
    }

    if (target) {
      router.navigate(target as Href);
      return;
    }

    router.navigate(fallback);
  }, [router, returnTo, fallback]);
}
