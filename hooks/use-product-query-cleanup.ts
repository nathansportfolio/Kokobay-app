import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

import {
  PRODUCT_QUERY_KEY_PREFIX,
  PRODUCT_RECOMMENDATIONS_QUERY_KEY_PREFIX,
} from '@/constants/product-query';

/** Drop inactive PDP product + recommendations cache when leaving the product screen. */
export function useProductQueryCleanup(): void {
  const queryClient = useQueryClient();

  useEffect(() => {
    return () => {
      queryClient.removeQueries({ queryKey: PRODUCT_QUERY_KEY_PREFIX, type: 'inactive' });
      queryClient.removeQueries({
        queryKey: PRODUCT_RECOMMENDATIONS_QUERY_KEY_PREFIX,
        type: 'inactive',
      });
    };
  }, [queryClient]);
}
