import { useRef } from 'react';

import type { ProductCardProps } from '@/components/ui/product-card';
import { isProductFullySoldOut } from '@/utils/product-availability';

type ProductCardRenderSnapshot = Pick<
  ProductCardProps,
  'gridColumns' | 'tileWidth' | 'imagePriority' | 'perfTraceIndex' | 'className'
> & {
  productId: string;
  title: string;
  priceAmount: string;
  soldOut: boolean;
};

function snapshotFromProps(props: ProductCardProps): ProductCardRenderSnapshot {
  return {
    productId: props.product.id,
    title: props.product.title,
    priceAmount: props.product.priceRange.minVariantPrice.amount,
    soldOut: isProductFullySoldOut(props.product),
    gridColumns: props.gridColumns,
    tileWidth: props.tileWidth,
    imagePriority: props.imagePriority,
    perfTraceIndex: props.perfTraceIndex,
    className: props.className,
  };
}

function diffProductCardRenderReasons(
  prev: ProductCardRenderSnapshot | null,
  next: ProductCardRenderSnapshot,
): string {
  if (!prev) return 'mount';
  const reasons: string[] = [];
  if (prev.productId !== next.productId) reasons.push('product');
  if (prev.title !== next.title) reasons.push('title');
  if (prev.priceAmount !== next.priceAmount) reasons.push('price');
  if (prev.soldOut !== next.soldOut) reasons.push('sold_out');
  if (prev.gridColumns !== next.gridColumns) reasons.push('grid');
  if (prev.tileWidth !== next.tileWidth) reasons.push('tile_width');
  if (prev.imagePriority !== next.imagePriority) reasons.push('image_priority');
  if (prev.perfTraceIndex !== next.perfTraceIndex) reasons.push('perf_index');
  if (prev.className !== next.className) reasons.push('className');
  return reasons.length ? reasons.join(',') : 'unknown';
}

/** Dev-only — logs `[PRODUCT_CARD_RENDER]` when the card actually renders. */
export function useProductCardRenderTrace(props: ProductCardProps): void {
  if (!__DEV__) return;
  const prevRef = useRef<ProductCardRenderSnapshot | null>(null);
  const next = snapshotFromProps(props);
  const reason = diffProductCardRenderReasons(prevRef.current, next);
  console.log('[PRODUCT_CARD_RENDER]', `handle=${props.product.handle}`, `reason=${reason}`);
  prevRef.current = next;
}

export function productCardPropsEqual(prev: ProductCardProps, next: ProductCardProps): boolean {
  return (
    prev.product.id === next.product.id &&
    prev.product.handle === next.product.handle &&
    prev.product.title === next.product.title &&
    prev.product.priceRange.minVariantPrice.amount ===
      next.product.priceRange.minVariantPrice.amount &&
    prev.product.priceRange.minVariantPrice.currencyCode ===
      next.product.priceRange.minVariantPrice.currencyCode &&
    isProductFullySoldOut(prev.product) === isProductFullySoldOut(next.product) &&
    prev.className === next.className &&
    prev.imagePriority === next.imagePriority &&
    prev.gridColumns === next.gridColumns &&
    prev.tileWidth === next.tileWidth &&
    prev.perfTraceIndex === next.perfTraceIndex &&
    prev.perfTraceScreen === next.perfTraceScreen &&
    prev.disableImageTransition === next.disableImageTransition
  );
}
