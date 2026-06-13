import { ProductGridSkeleton } from '@/components/ui/product-grid-skeleton';

type Props = {
  itemWidth: number;
  cellHeight: number;
  columnGap: number;
  columns?: number;
  rows?: number;
  withFooterCta?: boolean;
};

/** 2-column grid skeleton — matches PLP tile dimensions used on the wishlist screen. */
export function WishlistGridSkeleton({
  itemWidth,
  cellHeight,
  columnGap,
  columns = 2,
  rows = 2,
  withFooterCta = true,
}: Props) {
  return (
    <ProductGridSkeleton
      columns={columns}
      rows={rows}
      itemWidth={itemWidth}
      cellHeight={cellHeight}
      columnGap={columnGap}
      withFooterCta={withFooterCta}
    />
  );
}
