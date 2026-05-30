import { PixelRatio } from 'react-native';

import { applyShopifyCdnImageParams, isShopifyCdnUrl } from '@/utils/shopify-cdn-image';

/** In-page PDP carousel — full-bleed gallery. */
export const PDP_GALLERY_IMAGE_MAX_WIDTH = 1200;

/** Fullscreen lightbox / pinch-zoom — higher cap than carousel. */
export const PDP_LIGHTBOX_IMAGE_MAX_WIDTH = 1600;

export type ProductPdpImageSource = {
  url: string;
  width?: number | null;
  height?: number | null;
  screenWidth?: number;
  handle?: string;
};

function pdpDeliveryWidth(screenWidth: number | undefined, maxWidth: number, minWidth: number): number {
  if (screenWidth == null || screenWidth <= 0) {
    return maxWidth;
  }
  const devicePixels = Math.ceil(screenWidth * PixelRatio.get());
  const stepped = Math.ceil(devicePixels / 50) * 50;
  return Math.min(maxWidth, Math.max(minWidth, stepped));
}

function transformPdpImageUri(
  source: ProductPdpImageSource,
  maxWidth: number,
  minWidth: number,
): string {
  const originalUrl = source.url.trim();
  if (!originalUrl) return originalUrl;

  const targetWidth = pdpDeliveryWidth(source.screenWidth, maxWidth, minWidth);

  if (!isShopifyCdnUrl(originalUrl)) {
    return originalUrl;
  }

  return applyShopifyCdnImageParams(originalUrl, targetWidth);
}

/** Device-sized URL for the PDP in-page image carousel. */
export function productPdpGalleryImageUri(source: ProductPdpImageSource): string {
  return transformPdpImageUri(source, PDP_GALLERY_IMAGE_MAX_WIDTH, 600);
}

/** Higher-resolution URL for fullscreen lightbox / zoom. */
export function productPdpLightboxImageUri(source: ProductPdpImageSource): string {
  return transformPdpImageUri(source, PDP_LIGHTBOX_IMAGE_MAX_WIDTH, 800);
}
