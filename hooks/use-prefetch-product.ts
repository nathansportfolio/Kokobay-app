import { useQueryClient } from '@tanstack/react-query';

import {
  PRODUCT_QUERY_GC_TIME_MS,
  PRODUCT_QUERY_STALE_TIME_MS,
} from '@/constants/product-query';
import { useMarketQueryKey } from '@/hooks/use-market-query-key';
import { getProduct } from '@/services/shopify';
import type { Image as ProductImage } from '@/types/shopify';
import { prefetchPdpGalleryForProduct, prefetchPdpGalleryImageUris } from '@/utils/product-pdp-image-prefetch';
import { productQueryKey } from '@/utils/product-query-key';

export type ProductPrefetchImageHint = Pick<ProductImage, 'url' | 'width' | 'height'>;

/** Warm PDP cache (+ hero image) on press-in for snappier navigation. */
export function usePrefetchProduct() {
  const queryClient = useQueryClient();
  const marketKey = useMarketQueryKey();

  return (handle: string, imageHint?: ProductPrefetchImageHint) => {
    const h = handle?.trim();
    if (!h) return;

    if (imageHint?.url) {
      prefetchPdpGalleryImageUris([imageHint], { heroOnly: true });
    }

    void queryClient.prefetchQuery({
      queryKey: productQueryKey(h, marketKey),
      queryFn: async ({ signal }) => {
        const product = await getProduct(h, { signal });
        if (product) {
          prefetchPdpGalleryForProduct(product);
        }
        return product;
      },
      staleTime: PRODUCT_QUERY_STALE_TIME_MS,
      gcTime: PRODUCT_QUERY_GC_TIME_MS,
    });
  };
}
