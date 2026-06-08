import { useLocalSearchParams, usePathname } from 'expo-router';
import type { Href } from 'expo-router';

import { isHomePath, productHref, productReturnToParam } from '@/utils/product-navigation';

export function useProductHref(handle: string): Href {
  const pathname = usePathname();
  if (isHomePath(pathname)) {
    return productHref(handle);
  }
  const { returnTo } = useLocalSearchParams<{ returnTo?: string }>();
  const existing = typeof returnTo === 'string' ? returnTo : undefined;
  return productHref(handle, productReturnToParam(pathname, existing));
}
