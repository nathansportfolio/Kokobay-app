import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

import {
  KOKOBAY_COLLECTION_PRODUCTS_QUERY_KEY,
  KOKOBAY_SEARCH_PRODUCTS_QUERY_KEY,
} from '@/constants/kokobay-catalog-query';

export type KokobayCatalogQueryScope = 'collection' | 'search';

function catalogQueryKeyForScope(scope: KokobayCatalogQueryScope) {
  return scope === 'collection'
    ? KOKOBAY_COLLECTION_PRODUCTS_QUERY_KEY
    : KOKOBAY_SEARCH_PRODUCTS_QUERY_KEY;
}

/** Drop inactive Kokobay catalog infinite-query cache when a PLP screen unmounts. */
export function useKokobayCatalogQueryCleanup(scope: KokobayCatalogQueryScope): void {
  const queryClient = useQueryClient();

  useEffect(() => {
    return () => {
      queryClient.removeQueries({
        queryKey: catalogQueryKeyForScope(scope),
        type: 'inactive',
      });
    };
  }, [queryClient, scope]);
}
