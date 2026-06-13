import { isLikelyRemoteImageUrl } from '@/utils/catalog-image';

export type ProductCardPreviewImage = {
  url: string;
  width?: number | null;
  height?: number | null;
  key: string;
};

/** Up to `max` unique, valid product images for tile preview carousels. */
export function productCardPreviewImages(
  product: {
    images: { id?: string; url: string; width?: number | null; height?: number | null }[];
  },
  max = 3,
): ProductCardPreviewImage[] {
  const seen = new Set<string>();
  const out: ProductCardPreviewImage[] = [];

  for (const img of product.images) {
    if (!isLikelyRemoteImageUrl(img.url)) continue;
    const url = img.url.trim();
    const key = img.id ?? url;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ url, width: img.width, height: img.height, key });
    if (out.length >= max) break;
  }

  return out;
}
