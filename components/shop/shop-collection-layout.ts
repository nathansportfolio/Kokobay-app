/** Width/height — matches editorial collection tiles (`aspectRatio` 4/5). */
export const SHOP_CATEGORY_EDITORIAL_ASPECT = 4 / 5;

/** Text stack under the image — fixed so every row matches FlashList layout. */
export const SHOP_COLLECTION_EDITORIAL_TEXT_BLOCK = 136;
const EDITORIAL_CARD_GAP = 44;

/** Shop tab — short cover strip with title overlaid (see `variant="strip"`). */
export const SHOP_COLLECTION_STRIP_HEIGHT = 100;
export const SHOP_COLLECTION_STRIP_GAP = 8;
/** Horizontal inset for strip cards — keep in sync with `ShopCollectionEditorialCard`. */
export const SHOP_COLLECTION_STRIP_HORIZONTAL_PADDING = 20;
export const SHOP_COLLECTION_STRIP_BORDER_RADIUS = 8;

export const shopCollectionStripCardShadow = {
  shadowColor: '#2C2925',
  shadowOffset: { width: 0, height: 1 },
  shadowOpacity: 0.07,
  shadowRadius: 3,
  elevation: 2,
} as const;

/** Single editorial collection row — keep in sync with `ShopCollectionEditorialCard`. */
export function shopByCategoryEditorialItemHeight(screenWidth: number): number {
  const imageH = screenWidth / SHOP_CATEGORY_EDITORIAL_ASPECT;
  return imageH + SHOP_COLLECTION_EDITORIAL_TEXT_BLOCK + EDITORIAL_CARD_GAP;
}

/** Single strip row on the Shop tab — keep in sync with `ShopCollectionEditorialCard`. */
export function shopByCategoryStripItemHeight(): number {
  return SHOP_COLLECTION_STRIP_HEIGHT + SHOP_COLLECTION_STRIP_GAP;
}

export function shopByCategoryEditorialListHeight(
  screenWidth: number,
  collectionCount: number,
): number {
  if (collectionCount === 0) return 28;
  return collectionCount * shopByCategoryEditorialItemHeight(screenWidth);
}
