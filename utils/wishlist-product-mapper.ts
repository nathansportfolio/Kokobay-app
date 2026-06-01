import type { Product } from '@/types/shopify';
import type { WishlistProductPreview } from '@/types/wishlist-product-preview';
import { isLikelyRemoteImageUrl } from '@/utils/catalog-image';

function moneyAmount(value: number): string {
  return Number.isFinite(value) ? String(value) : '0';
}

/** Map wishlist API preview → minimal `Product` for grid cards / quick-add. */
export function wishlistPreviewToProduct(
  preview: WishlistProductPreview,
  currencyCode: string,
): Product | null {
  const handle = preview.handle.trim();
  const title = preview.title.trim();
  if (!handle || !title) return null;

  const code = currencyCode.trim().toUpperCase() || 'GBP';
  const amount = moneyAmount(preview.price);
  const price = { amount, currencyCode: code };
  const compareAmount =
    preview.compareAtPrice != null && preview.compareAtPrice > preview.price
      ? moneyAmount(preview.compareAtPrice)
      : null;

  const imageUrl = preview.imageUrl?.trim();
  const featured =
    imageUrl && isLikelyRemoteImageUrl(imageUrl)
      ? { url: imageUrl, altText: null as string | null, width: null, height: null }
      : null;

  return {
    id: `wishlist:${handle}`,
    handle,
    title,
    availableForSale: preview.available,
    tags: [],
    images: featured ? [featured] : [],
    variants: [
      {
        id: `wishlist:${handle}:default`,
        title: 'Default',
        availableForSale: preview.available,
        price,
        compareAtPrice: compareAmount ? { amount: compareAmount, currencyCode: code } : null,
        selectedOptions: [],
        image: featured,
      },
    ],
    priceRange: { minVariantPrice: price, maxVariantPrice: price },
  };
}
