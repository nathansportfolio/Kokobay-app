import { useRouter, useLocalSearchParams, type Href } from 'expo-router';
import { useCallback } from 'react';

const DEFAULT_FALLBACK = '/(tabs)/categories' as Href;

/** Tab routes jump instead of stack — use `returnTo` when the native back stack is empty. */
export function useReturnToGoBack(fallback: Href = DEFAULT_FALLBACK) {
  const router = useRouter();
  const { returnTo } = useLocalSearchParams<{ returnTo?: string }>();

  return useCallback(() => {
    const target = typeof returnTo === 'string' ? returnTo.trim() : '';
    if (target) {
      router.navigate(target as Href);
      return;
    }
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.navigate(fallback);
  }, [router, returnTo, fallback]);
}
