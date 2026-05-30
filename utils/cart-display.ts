import type { Product, ProductVariant } from '@/types/shopify';
import { firstValidProductImageUrl, isLikelyRemoteImageUrl } from '@/utils/catalog-image';

/** Human-readable variant line for bag / receipts */
export function variantLabelForCart(variant: ProductVariant): string {
  const opts = variant.selectedOptions
    .filter((o) => o.value?.trim())
    .map((o) => `${o.name}: ${o.value}`);
  if (opts.length) return opts.join(' · ');
  const t = variant.title?.trim();
  if (t && t !== 'Default Title') return t;
  return 'One size';
}

function optionDisplayRank(name: string): number {
  const l = name.toLowerCase();
  if (l === 'color' || l === 'colour') return 0;
  if (l === 'size') return 1;
  return 2;
}

/**
 * Cart row: values only — up to two options on separate lines (colour before size when both exist);
 * three or more joined on one line with ` - `.
 */
export function variantValueLinesForCart(variant: ProductVariant): string[] {
  const raw = variant.selectedOptions.filter((o) => o.value?.trim());
  if (!raw.length) {
    const t = variant.title?.trim();
    if (t && t !== 'Default Title') return [t];
    return ['One size'];
  }
  const ordered = [...raw].sort((a, b) => optionDisplayRank(a.name) - optionDisplayRank(b.name));
  const values = ordered.map((o) => o.value.trim());
  if (values.length <= 2) return values;
  return [values.join(' - ')];
}

/** Parse snapshot strings like `Color: Navy · Size: M` into value-only tokens. */
export function variantSnapshotValueLines(snapshot: string): string[] | null {
  const s = snapshot.trim();
  if (!s) return null;
  const segments = s.split(/\s*[·•]\s*/).map((x) => x.trim()).filter(Boolean);
  if (segments.length === 0) return null;
  const values = segments.map((seg) => {
    const m = seg.match(/^([^:]+):\s*(.+)$/);
    return m ? m[2]!.trim() : seg;
  });
  if (values.length >= 3) return [values.join(' - ')];
  return values;
}

/** Prefer variant-specific image when valid, else first catalog image */
export function imageUrlForCartLine(product: Product, variant: ProductVariant | undefined): string | undefined {
  const v = variant?.image?.url;
  if (isLikelyRemoteImageUrl(v)) return v!.trim();
  return firstValidProductImageUrl(product);
}
