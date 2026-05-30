import { productCardTextBlockHeight } from '@/constants/product-card-typography';

/** 3:4 image + title (2 lines) + price + padding — must match `ProductCard` for FlashList grid. */
export function collectionProductCellHeight(tileWidth: number, numColumns: 1 | 2): number {
  const imageH = Math.ceil(tileWidth * (4 / 3));
  const textBlock = productCardTextBlockHeight(numColumns);
  const rowMargin = 14;
  return imageH + textBlock + rowMargin;
}

export function collectionProductImageHeight(tileWidth: number): number {
  return Math.ceil(tileWidth * (4 / 3));
}
