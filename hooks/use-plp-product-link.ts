import type { Href } from 'expo-router';
import { useLocalSearchParams, usePathname } from 'expo-router';
import { useCallback, useMemo, useRef } from 'react';
import { useIsFocused } from '@react-navigation/native';

import { isCatalogListingPath, productHref, productReturnToParam } from '@/utils/product-navigation';

/** One router subscription per PLP screen — avoids per-tile `usePathname` in product cards. */
export function usePlpProductLink(): (handle: string) => Href {
  const pathname = usePathname();
  const isFocused = useIsFocused();
  const { returnTo } = useLocalSearchParams<{ returnTo?: string }>();
  const listingPathRef = useRef(pathname);

  if (isFocused && isCatalogListingPath(pathname)) {
    listingPathRef.current = pathname;
  }

  const effectiveListingPath = isCatalogListingPath(pathname)
    ? pathname
    : listingPathRef.current;

  const plpReturnTo = useMemo(
    () =>
      productReturnToParam(
        effectiveListingPath,
        typeof returnTo === 'string' ? returnTo : undefined,
      ),
    [effectiveListingPath, returnTo],
  );

  return useCallback((handle: string) => productHref(handle, plpReturnTo), [plpReturnTo]);
}
