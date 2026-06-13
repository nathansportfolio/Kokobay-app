/** Default gap between `ProductCard` tiles in horizontal carousels. */
export const PRODUCT_CARD_CAROUSEL_TILE_GAP = 4;

/** How many cards fit in the viewport — 2 full tiles plus a half-tile peek. */
export const PRODUCT_CARD_CAROUSEL_VISIBLE_COUNT = 2.5;

/**
 * Tile width so `visibleCount` cards (including fractional peek) fit in `viewportWidth`.
 * @example 2.5 visible → two full cards, one half card, and two inter-tile gaps.
 */
export function productCarouselTileWidth(
  viewportWidth: number,
  tileGap: number = PRODUCT_CARD_CAROUSEL_TILE_GAP,
  visibleCount: number = PRODUCT_CARD_CAROUSEL_VISIBLE_COUNT,
): number {
  const viewport = Math.max(0, viewportWidth);
  if (viewport <= 0 || visibleCount <= 0) return 0;

  const gapCount = Math.max(0, Math.ceil(visibleCount) - 1);
  const raw = (viewport - gapCount * tileGap) / visibleCount;
  return Math.max(1, Math.floor(raw));
}
