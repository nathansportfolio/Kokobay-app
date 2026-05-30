import { Platform } from 'react-native';

const SHOPIFY_CDN_HOST_RE = /(?:^|\.)shopify(?:cdn)?\.com$|\.kokobay\.co\.uk$/i;

export type ShopifyCdnImageFormat = 'webp' | 'jpg' | 'png';

export function isShopifyCdnUrl(url: string): boolean {
  try {
    return SHOPIFY_CDN_HOST_RE.test(new URL(url).hostname);
  } catch {
    return false;
  }
}

/**
 * Shopify JPEG/WebP responses embed a minimal sRGB ICC profile ("c2ci") that triggers
 * noisy `[ColorSync] Invalid profile 'c2ci'` logs on iOS when expo-image decodes them.
 * PNG responses from the CDN omit ICC metadata. Use PNG in iOS dev only (larger files).
 */
export function shopifyCdnDeliveryFormat(): ShopifyCdnImageFormat {
  if (__DEV__ && Platform.OS === 'ios') {
    return 'png';
  }
  return 'webp';
}

/**
 * Rewrite Shopify CDN URLs for iOS dev so decoded bitmaps skip the c2ci ICC profile.
 * No-op on Android, production builds, and non-Shopify hosts.
 */
export function shopifyCdnUriForPlatform(uri: string): string {
  const trimmed = uri.trim();
  if (!trimmed || !isShopifyCdnUrl(trimmed)) return trimmed;
  if (!(__DEV__ && Platform.OS === 'ios')) return trimmed;

  try {
    const parsed = new URL(trimmed);
    parsed.searchParams.set('format', 'png');
    return parsed.toString();
  } catch {
    return trimmed;
  }
}

/** Apply Shopify CDN resize params — aspect ratio is preserved when only `width` is set. */
export function applyShopifyCdnImageParams(
  originalUrl: string,
  targetWidth: number,
  format: ShopifyCdnImageFormat = shopifyCdnDeliveryFormat(),
): string {
  const trimmed = originalUrl.trim();
  if (!trimmed || !isShopifyCdnUrl(trimmed)) return trimmed;

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return trimmed;
  }

  parsed.searchParams.set('width', String(targetWidth));
  parsed.searchParams.set('format', format);
  return parsed.toString();
}
