import { useLocalSearchParams, usePathname } from 'expo-router';
import type { Href } from 'expo-router';

import { collectionHref, collectionReturnToParam } from '@/utils/collection-navigation';

export function useCollectionHref(handle: string): Href {
  const pathname = usePathname();
  const { returnTo } = useLocalSearchParams<{ returnTo?: string }>();
  const existing = typeof returnTo === 'string' ? returnTo : undefined;
  return collectionHref(handle, collectionReturnToParam(pathname, existing));
}
