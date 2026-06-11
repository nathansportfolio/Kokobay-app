import type { Collection, Image, Product, ProductVariant } from '@/types/shopify';

import type {
  KokobayStorefrontCollectionSummary,
  KokobayStorefrontImage,
  KokobayStorefrontProduct,
  KokobayStorefrontProductPreview,
  KokobayStorefrontVariant,
} from './storefront-types';

function mapImage(img: KokobayStorefrontImage): Image | null {
  if (!img?.url) return null;
  return {
    url: img.url,
    altText: img.altText ?? null,
    width: img.width ?? null,
    height: img.height ?? null,
  };
}

function mapVariant(v: KokobayStorefrontVariant, fallbackImage: Image | null): ProductVariant {
  return {
    id: v.id,
    title: v.title,
    availableForSale: v.availableForSale,
    price: v.price,
    compareAtPrice: v.compareAtPrice,
    selectedOptions: v.selectedOptions ?? [],
    image: fallbackImage,
  };
}

function mapImages(
  featured: Image | null,
  extra: KokobayStorefrontProduct['images'],
): Image[] {
  const out: Image[] = [];
  const seen = new Set<string>();
  const push = (img: Image | null) => {
    if (!img?.url || seen.has(img.url)) return;
    seen.add(img.url);
    out.push(img);
  };
  push(featured);
  for (const raw of extra ?? []) {
    push(mapImage(raw));
  }
  return out;
}

export function storefrontProductToProduct(node: KokobayStorefrontProduct | null | undefined): Product | null {
  if (!node?.id || !node.handle) return null;

  const featured = mapImage(node.featuredImage);
  const images = mapImages(featured, node.images);
  const variants = (node.variants ?? []).map((v) => mapVariant(v, featured));

  return {
    id: node.id,
    handle: node.handle,
    title: node.title,
    description: node.description ?? undefined,
    descriptionHtml: node.descriptionHtml ?? undefined,
    availableForSale: node.availableForSale,
    vendor: node.vendor || undefined,
    productType: node.productType ?? undefined,
    tags: node.tags ?? [],
    images,
    variants: variants.length
      ? variants
      : [
          {
            id: `${node.id}-default`,
            title: 'Default',
            availableForSale: node.availableForSale,
            price: node.priceRange.minVariantPrice,
            compareAtPrice: null,
            selectedOptions: [],
            image: featured,
          },
        ],
    priceRange: node.priceRange,
    ...(node.fitData ? { fitData: node.fitData } : {}),
  };
}

export function storefrontProductPreviewToProduct(
  node: KokobayStorefrontProductPreview | null | undefined,
): Product | null {
  if (!node?.id || !node.handle) return null;

  const featured = mapImage(node.featuredImage);
  const images = featured ? [featured] : [];

  return {
    id: node.id,
    handle: node.handle,
    title: node.title,
    availableForSale: node.availableForSale,
    vendor: node.vendor || undefined,
    tags: [],
    images,
    variants: [
      {
        id: `${node.id}-preview`,
        title: 'Default',
        availableForSale: node.availableForSale,
        price: node.priceRange.minVariantPrice,
        compareAtPrice: null,
        selectedOptions: [],
        image: featured,
      },
    ],
    priceRange: node.priceRange,
  };
}

export function storefrontCollectionSummaryToCollection(
  node: KokobayStorefrontCollectionSummary | null | undefined,
): Collection | null {
  if (!node?.id || !node.handle) return null;
  return {
    id: node.id,
    handle: node.handle,
    title: node.title,
    description: node.description ?? undefined,
    descriptionHtml: node.descriptionHtml ?? undefined,
    image: mapImage(node.image),
  };
}
