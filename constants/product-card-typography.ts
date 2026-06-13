/** Product card title/price — keep in sync with `ProductCard` and `collectionProductCellHeight`. */

export type ProductCardTypoPreset = {
  titleFontSize: number;
  titleLineHeight: number;
  priceFontSize: number;
  priceLineHeight: number;
  paddingTop: number;
  paddingBottom: number;
  paddingHorizontal: number;
  gap: number;
};

const TITLE_FONT_SIZE = 13;
const TITLE_LINE_HEIGHT = 17;
const PRICE_FONT_SIZE = 14;
const PRICE_LINE_HEIGHT = 18;

export const PRODUCT_CARD_TYPO_GRID: ProductCardTypoPreset = {
  titleFontSize: TITLE_FONT_SIZE,
  titleLineHeight: TITLE_LINE_HEIGHT,
  priceFontSize: PRICE_FONT_SIZE,
  priceLineHeight: PRICE_LINE_HEIGHT,
  paddingTop: 8,
  paddingBottom: 4,
  paddingHorizontal: 8,
  gap: 4,
};

export const PRODUCT_CARD_TYPO_COMFORT: ProductCardTypoPreset = {
  titleFontSize: TITLE_FONT_SIZE,
  titleLineHeight: TITLE_LINE_HEIGHT,
  priceFontSize: PRICE_FONT_SIZE,
  priceLineHeight: PRICE_LINE_HEIGHT,
  paddingTop: 10,
  paddingBottom: 6,
  paddingHorizontal: 8,
  gap: 4,
};

export function productCardTypoPreset(numColumns: 1 | 2): ProductCardTypoPreset {
  return numColumns === 1 ? PRODUCT_CARD_TYPO_COMFORT : PRODUCT_CARD_TYPO_GRID;
}

/** Extra block below title/price when `ProductCard` uses `actionVariant="add_to_bag"`. */
export const PRODUCT_CARD_FOOTER_CTA_BLOCK = {
  paddingTop: 4,
  paddingBottom: 8,
  paddingHorizontal: 8,
  buttonHeight: 32,
} as const;

export function productCardFooterCtaBlockHeight(): number {
  const b = PRODUCT_CARD_FOOTER_CTA_BLOCK;
  return b.paddingTop + b.buttonHeight + b.paddingBottom;
}

/** FlashList cell text block — must match `ProductCard` title block layout. */
export function productCardTextBlockHeight(numColumns: 1 | 2): number {
  const t = productCardTypoPreset(numColumns);
  return (
    t.paddingTop +
    t.paddingBottom +
    t.titleLineHeight * 2 +
    t.gap +
    t.priceLineHeight
  );
}
