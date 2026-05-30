import { isKokobayWebProductsConfigured } from '@/services/kokobay-web/client';
import { isShopifyConfigured } from '@/services/shopify/client';

/** True when cart can sync to Shopify (Koko Bay web proxy or direct Storefront). */
export function isRemoteCartConfigured(): boolean {
  return isKokobayWebProductsConfigured() || isShopifyConfigured();
}

/** Prefer Koko Bay `/api/cart` — server holds Storefront credentials; catalog stays on Mongo. */
export function usesKokobayCartProxy(): boolean {
  return isKokobayWebProductsConfigured();
}
