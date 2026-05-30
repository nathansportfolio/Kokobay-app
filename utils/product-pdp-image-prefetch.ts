import { Image } from 'expo-image';
import { Dimensions } from 'react-native';

import type { Image as ProductImage, Product } from '@/types/shopify';
import { isLikelyRemoteImageUrl } from '@/utils/catalog-image';
import { productPdpGalleryImageUri } from '@/utils/product-pdp-image-uri';
import { shopifyCdnUriForPlatform } from '@/utils/shopify-cdn-image';

function windowWidth(): number {
  return Dimensions.get('window').width;
}

function prefetchResolvedUri(uri: string): void {
  const resolved = shopifyCdnUriForPlatform(uri.trim());
  if (!resolved) return;
  void Image.prefetch(resolved);
}

/** Warm expo-image disk/memory cache for PDP gallery URLs. */
export function prefetchPdpGalleryImageUris(
  images: Array<Pick<ProductImage, 'url' | 'width' | 'height'>>,
  options?: { heroOnly?: boolean; screenWidth?: number },
): void {
  const screenW = options?.screenWidth ?? windowWidth();
  const slice = options?.heroOnly ? images.slice(0, 1) : images.slice(0, 4);

  for (const image of slice) {
    if (!isLikelyRemoteImageUrl(image.url)) continue;
    prefetchResolvedUri(
      productPdpGalleryImageUri({
        url: image.url,
        width: image.width,
        height: image.height,
        screenWidth: screenW,
      }),
    );
  }
}

export function prefetchPdpGalleryForProduct(
  product: Product,
  options?: { heroOnly?: boolean; screenWidth?: number },
): void {
  const images = product.images.filter((image) => isLikelyRemoteImageUrl(image.url));
  prefetchPdpGalleryImageUris(images, options);
}
