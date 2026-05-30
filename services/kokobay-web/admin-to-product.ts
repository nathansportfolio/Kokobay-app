import type { Image, Money, Product, ProductVariant } from '@/types/shopify';
import { isLikelyRemoteImageUrl } from '@/utils/catalog-image';

const DEFAULT_CURRENCY = 'GBP';

function money(amount: string | undefined | null): Money {
  const n = amount != null && amount !== '' ? Number.parseFloat(String(amount)) : Number.NaN;
  return {
    amount: Number.isFinite(n) ? String(n) : '0',
    currencyCode: DEFAULT_CURRENCY,
  };
}

function stripHtml(html: string | undefined): string {
  if (!html) return '';
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function tagsArray(tags: string | undefined | null): string[] {
  if (!tags || typeof tags !== 'string') return [];
  return tags
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);
}

/** Shopify REST often uses numeric ids; JSON may deserialize as string. */
function parseShopifyNumericId(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string' && value.trim() !== '') {
    const n = Number.parseInt(value, 10);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

type AdminImage = {
  id?: number | string;
  src?: string;
  alt?: string | null;
  width?: number;
  height?: number;
  position?: number;
};
type AdminOption = { name?: string };
type AdminVariant = {
  id?: number | string;
  title?: string;
  sku?: string | null;
  price?: string;
  compare_at_price?: string | null;
  option1?: string | null;
  option2?: string | null;
  option3?: string | null;
  inventory_quantity?: number | null;
};

type AdminProduct = {
  id?: number | string;
  title?: string;
  handle?: string;
  body_html?: string;
  tags?: string;
  product_type?: string;
  vendor?: string;
  status?: string;
  images?: AdminImage[];
  image?: AdminImage | null;
  variants?: AdminVariant[];
  options?: AdminOption[];
};

function gid(kind: 'Product' | 'ProductVariant' | 'ImageSource', numericId: number): string {
  return `gid://shopify/${kind}/${numericId}`;
}

function mapImages(images: AdminImage[] | undefined, fallback: AdminImage | null | undefined): Image[] {
  const raw = images?.length ? [...images] : fallback ? [fallback] : [];
  const usable = raw.filter((img) => isLikelyRemoteImageUrl(img.src));
  usable.sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
  const seenIds = new Set<number>();
  const deduped: AdminImage[] = [];
  for (const img of usable) {
    const nid = parseShopifyNumericId(img.id);
    if (nid != null) {
      if (seenIds.has(nid)) continue;
      seenIds.add(nid);
    }
    deduped.push(img);
  }
  return deduped.map((img, i) => {
    const id = parseShopifyNumericId(img.id) ?? i + 1;
    return {
      id: gid('ImageSource', id),
      url: img.src!.trim(),
      altText: img.alt ?? null,
      width: img.width ?? null,
      height: img.height ?? null,
    };
  });
}

function mapVariant(
  v: AdminVariant,
  product: AdminProduct,
  index: number,
  productImages: Image[],
): ProductVariant {
  const vid = parseShopifyNumericId(v.id) ?? index + 1;
  const opts = product.options ?? [];
  const vals = [v.option1, v.option2, v.option3].filter((x) => x != null && x !== '') as string[];
  const selectedOptions = vals.map((value, i) => ({
    name: opts[i]?.name ?? `Option ${i + 1}`,
    value,
  }));
  const qty = v.inventory_quantity ?? 0;
  const availableForSale = qty > 0;
  const image = productImages[0] ?? null;
  return {
    id: gid('ProductVariant', vid),
    title: v.title ?? 'Default Title',
    availableForSale,
    quantityAvailable: qty > 0 ? qty : 0,
    price: money(v.price),
    compareAtPrice: v.compare_at_price ? money(v.compare_at_price) : null,
    selectedOptions,
    image,
  };
}

function priceRangeFromVariants(variants: ProductVariant[]): { minVariantPrice: Money; maxVariantPrice: Money } {
  if (!variants.length) {
    const z = money('0');
    return { minVariantPrice: z, maxVariantPrice: z };
  }
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;
  for (const v of variants) {
    const n = Number.parseFloat(v.price.amount);
    if (Number.isFinite(n)) {
      min = Math.min(min, n);
      max = Math.max(max, n);
    }
  }
  if (!Number.isFinite(min) || !Number.isFinite(max)) {
    const z = money('0');
    return { minVariantPrice: z, maxVariantPrice: z };
  }
  const cur = variants[0].price.currencyCode;
  return {
    minVariantPrice: { amount: String(min), currencyCode: cur },
    maxVariantPrice: { amount: String(max), currencyCode: cur },
  };
}

export function adminProductToProduct(raw: unknown): Product | null {
  if (!raw || typeof raw !== 'object') return null;
  const p = raw as AdminProduct;
  const pid = parseShopifyNumericId(p.id);
  const handle = p.handle?.trim();
  if (pid == null || !handle) return null;

  const productImages = mapImages(p.images, p.image ?? undefined);
  const mapped = (p.variants ?? []).map((v, i) => mapVariant(v, p, i, productImages));
  const variants: ProductVariant[] = mapped.length
    ? mapped
    : [
        {
          id: gid('ProductVariant', pid),
          title: 'Default Title',
          availableForSale: false,
          price: money('0'),
          compareAtPrice: null,
          selectedOptions: [],
          image: productImages[0] ?? null,
        },
      ];

  const tags = tagsArray(p.tags);
  const body = p.body_html ?? '';
  const description = stripHtml(body);
  const availableForSale = variants.some((v) => v.availableForSale);
  const priceRange = priceRangeFromVariants(variants);

  return {
    id: gid('Product', pid),
    handle,
    title: p.title ?? handle,
    description,
    descriptionHtml: body || `<p>${description}</p>`,
    availableForSale,
    vendor: p.vendor ?? undefined,
    productType: p.product_type ?? undefined,
    tags,
    images: productImages,
    variants,
    priceRange,
  };
}
