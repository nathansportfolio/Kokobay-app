import { useRouter, useLocalSearchParams, type Href } from 'expo-router';
import { useCallback } from 'react';

import { shouldFollowProductReturnTo } from '@/utils/product-navigation';

const COLLECTIONS_HREF = '/(tabs)/categories' as Href;

/**
 * Search results PLP — back goes to Collections (not search overlay or arbitrary tab history).
 * Honors `returnTo` when this screen was opened with an explicit catalog return target.
 */
export function useSearchPlpGoBack() {
  const router = useRouter();
  const { returnTo } = useLocalSearchParams<{ returnTo?: string }>();

  return useCallback(() => {
    const target = typeof returnTo === 'string' ? returnTo.trim() : '';
    if (shouldFollowProductReturnTo(target)) {
      router.navigate(target as Href);
      return;
    }
    router.navigate(COLLECTIONS_HREF);
  }, [router, returnTo]);
}
