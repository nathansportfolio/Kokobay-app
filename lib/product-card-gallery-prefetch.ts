import type { QueryClient } from '@tanstack/react-query';

import {
  PRODUCT_QUERY_GC_TIME_MS,
  PRODUCT_QUERY_STALE_TIME_MS,
} from '@/constants/product-query';
import { getProduct } from '@/services/shopify';
import type { Product } from '@/types/shopify';
import { productCardPreviewImages } from '@/utils/product-card-preview-images';
import { productQueryKey } from '@/utils/product-query-key';

export const PLP_GALLERY_METADATA_PREFETCH_LIMIT = 20;

export function logGalleryPrefetchStarted(productId: string): void {
  if (!__DEV__) return;
  console.log('[GalleryPrefetch]', { productId, started: true });
}

export function logGalleryPrefetchCompleted(productId: string, imageCount: number): void {
  if (!__DEV__) return;
  console.log('[GalleryPrefetch]', { productId, completed: true, imageCount });
}

export function logCarouselCacheHit(productId: string, imageCount: number): void {
  if (!__DEV__) return;
  console.log('[CarouselCacheHit]', { productId, imageCount });
}

export function galleryPreviewImageCount(product: Product | undefined): number {
  if (!product) return 0;
  return productCardPreviewImages(product, 3).length;
}

/** Fetch full product into React Query — gallery metadata only (no expo-image prefetch). */
export async function prefetchProductGalleryMetadata(
  queryClient: QueryClient,
  handle: string,
  marketKey: string,
  productId: string,
): Promise<number> {
  const safeHandle = handle.trim();
  if (!safeHandle || !productId) return 0;

  const queryKey = productQueryKey(safeHandle, marketKey);
  const cached = queryClient.getQueryData<Product>(queryKey);
  if (cached) {
    const imageCount = galleryPreviewImageCount(cached);
    if (imageCount >= 2) {
      return imageCount;
    }
  }

  logGalleryPrefetchStarted(productId);

  try {
    const product = await queryClient.fetchQuery({
      queryKey,
      queryFn: ({ signal }) => getProduct(safeHandle, { signal }),
      staleTime: PRODUCT_QUERY_STALE_TIME_MS,
      gcTime: PRODUCT_QUERY_GC_TIME_MS,
    });
    const imageCount = galleryPreviewImageCount(product ?? undefined);
    logGalleryPrefetchCompleted(productId, imageCount);
    return imageCount;
  } catch {
    logGalleryPrefetchCompleted(productId, 0);
    return 0;
  }
}

export function prefetchVisibleProductGalleries(
  queryClient: QueryClient,
  marketKey: string,
  targets: { productId: string; handle: string }[],
): void {
  const slice = targets.slice(0, PLP_GALLERY_METADATA_PREFETCH_LIMIT);
  for (const { productId, handle } of slice) {
    void prefetchProductGalleryMetadata(queryClient, handle, marketKey, productId);
  }
}
