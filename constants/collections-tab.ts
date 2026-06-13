import type { CmsCollectionDisplayItem } from '@/utils/cms-collection-tiles';
import { collectionHasCoverImage } from '@/utils/collection-text';

/** Horizontal inset for nav rows and featured carousel. */
export const COLLECTIONS_TAB_HORIZONTAL_PAD = 20;

/** Vertical gap between nav rows. */
export const COLLECTIONS_TAB_NAV_ROW_GAP = 12;

/** Touch row — label line + vertical padding for a ~36pt target. */
export const COLLECTIONS_TAB_NAV_ROW_HEIGHT = 36;

/** Nav label — inline styles only; NativeWind arbitrary `text-[Npx]` often loses to variant presets. */
export const COLLECTIONS_TAB_NAV_LABEL = {
  fontFamily: 'InstrumentSans-Regular',
  fontSize: 11,
  lineHeight: 15,
  letterSpacing: 1.2,
} as const;

/** Space between nav list and featured carousel. */
export const COLLECTIONS_TAB_SECTION_SPACER = 16;

/** Featured carousel — tiles visible in the viewport (1 full + half peek). */
export const COLLECTIONS_TAB_FEATURED_VISIBLE_COUNT = 1.5;

/** Gap between featured carousel tiles. */
export const COLLECTIONS_TAB_FEATURED_GAP = 4;

/** Featured tile width/height — portrait editorial cards. */
export const COLLECTIONS_TAB_FEATURED_ASPECT = 0.75;

export const COLLECTIONS_TAB_FEATURED_BORDER_RADIUS = 0;

/** Featured tile title overlay — distance from bottom edge. */
export const COLLECTIONS_TAB_FEATURED_LABEL_BOTTOM = 24;

/** Featured tile title typography. */
export const COLLECTIONS_TAB_FEATURED_LABEL = {
  fontFamily: 'InstrumentSans-Medium',
  fontSize: 16,
  lineHeight: 20,
  letterSpacing: 1.1,
} as const;

export const COLLECTIONS_TAB_SKELETON_NAV_COUNT = 7;

export type CollectionsTabListItem =
  | {
      type: 'nav';
      key: string;
      item: CmsCollectionDisplayItem;
    }
  | { type: 'section-spacer'; key: 'section-spacer' }
  | {
      type: 'featured-carousel';
      key: 'featured-carousel';
      items: CmsCollectionDisplayItem[];
    };

export function collectionsTabFeaturedCarouselTileWidth(screenWidth: number): number {
  const contentWidth = screenWidth - COLLECTIONS_TAB_HORIZONTAL_PAD * 2;
  return Math.floor(
    (contentWidth - COLLECTIONS_TAB_FEATURED_GAP) / COLLECTIONS_TAB_FEATURED_VISIBLE_COUNT,
  );
}

export function collectionsTabFeaturedCarouselHeight(screenWidth: number): number {
  const tileWidth = collectionsTabFeaturedCarouselTileWidth(screenWidth);
  return Math.ceil(tileWidth / COLLECTIONS_TAB_FEATURED_ASPECT);
}

export function collectionsTabNavItemStride(): number {
  return COLLECTIONS_TAB_NAV_ROW_HEIGHT + COLLECTIONS_TAB_NAV_ROW_GAP;
}

/** Build list rows from CMS / catalog display items — order matches the API. */
export function buildCollectionsTabListItems(
  cmsItems: CmsCollectionDisplayItem[],
): CollectionsTabListItem[] {
  if (!cmsItems.length) return [];

  const items: CollectionsTabListItem[] = [];

  for (const item of cmsItems) {
    items.push({
      type: 'nav',
      key: `nav:${item.collection.id}`,
      item,
    });
  }

  const featuredItems = cmsItems.filter((entry) => collectionHasCoverImage(entry.collection));
  if (featuredItems.length > 0) {
    items.push({ type: 'section-spacer', key: 'section-spacer' });
    items.push({
      type: 'featured-carousel',
      key: 'featured-carousel',
      items: featuredItems,
    });
  }

  return items;
}

export function buildCollectionsTabSkeletonItems(): CollectionsTabListItem[] {
  const placeholders: CmsCollectionDisplayItem[] = Array.from(
    { length: COLLECTIONS_TAB_SKELETON_NAV_COUNT },
    (_, index) => ({
      collection: {
        id: `collections-tab-skeleton-${index}`,
        handle: `collections-tab-skeleton-${index}`,
        title: '',
        image: { url: 'https://placeholder.local/skeleton' },
      },
      cmsUrl: undefined,
    }),
  );

  return buildCollectionsTabListItems(placeholders);
}

export function collectionsTabListItemHeight(
  item: CollectionsTabListItem,
  screenWidth: number,
): number {
  switch (item.type) {
    case 'nav':
      return collectionsTabNavItemStride();
    case 'section-spacer':
      return COLLECTIONS_TAB_SECTION_SPACER;
    case 'featured-carousel':
      return collectionsTabFeaturedCarouselHeight(screenWidth);
  }
}

export const COLLECTIONS_TAB_SKELETON_ITEMS = buildCollectionsTabSkeletonItems();
