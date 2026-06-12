import { useRouter, useLocalSearchParams, usePathname, type Href } from 'expo-router';
import { useCallback } from 'react';

import {
  COLLECTIONS_TAB_HREF,
  isCategoriesStackCollectionPath,
  isCollectionsTabReturn,
} from '@/utils/collection-navigation';
import { shouldFollowProductReturnTo } from '@/utils/product-navigation';

/** Collection PLP default — shop tab, not home. */
const DEFAULT_FALLBACK = COLLECTIONS_TAB_HREF;

/** Tab routes jump instead of stack — use `returnTo` only when there is nothing to pop. */
export function useReturnToGoBack(fallback: Href = DEFAULT_FALLBACK) {
  const router = useRouter();
  const pathname = usePathname();
  const { returnTo } = useLocalSearchParams<{ returnTo?: string }>();

  return useCallback(() => {
    const target = typeof returnTo === 'string' ? returnTo.trim() : '';

    if (shouldFollowProductReturnTo(target)) {
      router.navigate(target as Href);
      return;
    }

    if (isCollectionsTabReturn(target)) {
      router.navigate(COLLECTIONS_TAB_HREF);
      return;
    }

    if (isCategoriesStackCollectionPath(pathname)) {
      if (router.canGoBack()) {
        router.back();
        return;
      }
      router.navigate(COLLECTIONS_TAB_HREF);
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
  }, [router, returnTo, fallback, pathname]);
}
