import type { Product } from '@/types/shopify';
import { firstValidProductImage } from '@/utils/catalog-image';

export type ProductCardDiffCategory =
  | 'product'
  | 'wishlist'
  | 'price'
  | 'image'
  | 'parent'
  | 'query_data'
  | 'navigation_state';

export type ProductCardTraceProps = {
  product: Product;
  className?: string;
  imagePriority?: 'low' | 'normal' | 'high' | null;
  gridColumns?: 1 | 2;
  tileWidth?: number;
  perfTraceIndex?: number;
  perfTraceScreen?: string;
  disableImageTransition?: boolean;
  wishlisted?: boolean;
  /** Dev diff — global wishlist Set reference at render time. */
  wishlistSetRef?: Set<string>;
  /** Dev diff — market query key (countryCode) at render time. */
  marketKey?: string;
  /** Dev diff — expo-router pathname (internal hook subscription). */
  pathname?: string;
  /** Dev diff — expo-router returnTo param (internal hook subscription). */
  returnTo?: string;
};

type ProductCardTraceSnapshot = {
  product: Product;
  productId: string;
  handle: string;
  priceAmount: string;
  currencyCode: string;
  imageUrl: string | undefined;
  wishlisted: boolean | undefined;
  wishlistSetRef: Set<string> | undefined;
  marketKey: string | undefined;
  pathname: string | undefined;
  returnTo: string | undefined;
  className: string | undefined;
  imagePriority: ProductCardTraceProps['imagePriority'];
  gridColumns: 1 | 2;
  tileWidth: number | undefined;
  perfTraceIndex: number | undefined;
  perfTraceScreen: string | undefined;
  disableImageTransition: boolean;
};

type ChangeCounts = Record<ProductCardDiffCategory, number>;

type StormSession = {
  renderCount: number;
  handlesSeen: Set<string>;
  changeCounts: ChangeCounts;
  collectionReferenceChanges: number;
  wishlistReferenceChanges: number;
  queryReferenceChanges: number;
  stormReportEmitted: boolean;
};

let session: StormSession | null = null;
let prevWishlistMapRef: Set<string> | null = null;
let prevCollectionProductsRef: Product[] | undefined;
let prevFlatItemsRef: Product[] | undefined;
let prevQueryDataUpdatedAt: number | undefined;

function emptyChangeCounts(): ChangeCounts {
  return {
    product: 0,
    wishlist: 0,
    price: 0,
    image: 0,
    parent: 0,
    query_data: 0,
    navigation_state: 0,
  };
}

function emptySession(): StormSession {
  return {
    renderCount: 0,
    handlesSeen: new Set(),
    changeCounts: emptyChangeCounts(),
    collectionReferenceChanges: 0,
    wishlistReferenceChanges: 0,
    queryReferenceChanges: 0,
    stormReportEmitted: false,
  };
}

/** Dev-only — `EXPO_PUBLIC_PRODUCT_CARD_DIFF=1` or foreground/freeze audit flags. */
export function isProductCardDiffTraceEnabled(): boolean {
  if (!__DEV__) return false;
  return (
    process.env.EXPO_PUBLIC_PRODUCT_CARD_DIFF === '1' ||
    process.env.EXPO_PUBLIC_JS_FREEZE_AUDIT === '1' ||
    process.env.EXPO_PUBLIC_FOREGROUND_AUDIT === '1'
  );
}

function isJsFreezeSessionActiveLazy(): boolean {
  const { isJsFreezeSessionActive } =
    require('@/lib/js-freeze-audit/state') as typeof import('@/lib/js-freeze-audit/state');
  return isJsFreezeSessionActive();
}

/** When only resume audit flags are set, trace during the JS freeze window. */
export function isProductCardDiffTraceActive(): boolean {
  if (!isProductCardDiffTraceEnabled()) return false;
  if (process.env.EXPO_PUBLIC_PRODUCT_CARD_DIFF === '1') return true;
  return isJsFreezeSessionActiveLazy();
}

export function resetProductCardStormTrace(): void {
  session = isProductCardDiffTraceActive() ? emptySession() : null;
  prevCollectionProductsRef = undefined;
  prevFlatItemsRef = undefined;
  prevQueryDataUpdatedAt = undefined;
}

function ensureSession(): StormSession {
  if (!session) session = emptySession();
  return session;
}

function snapshotFromProps(props: ProductCardTraceProps): ProductCardTraceSnapshot {
  const image = firstValidProductImage(props.product);
  return {
    product: props.product,
    productId: props.product.id,
    handle: props.product.handle,
    priceAmount: props.product.priceRange.minVariantPrice.amount,
    currencyCode: props.product.priceRange.minVariantPrice.currencyCode,
    imageUrl: image?.url,
    wishlisted: props.wishlisted,
    wishlistSetRef: props.wishlistSetRef,
    marketKey: props.marketKey,
    pathname: props.pathname,
    returnTo: props.returnTo,
    className: props.className,
    imagePriority: props.imagePriority,
    gridColumns: props.gridColumns ?? 2,
    tileWidth: props.tileWidth,
    perfTraceIndex: props.perfTraceIndex,
    perfTraceScreen: props.perfTraceScreen,
    disableImageTransition: props.disableImageTransition ?? true,
  };
}

function listPropsChanged(
  prev: ProductCardTraceSnapshot | null,
  next: ProductCardTraceSnapshot,
): string[] {
  if (!prev) return ['mount'];

  const changed: string[] = [];

  if (prev.product !== next.product) changed.push('product');
  if (prev.productId !== next.productId) changed.push('product.id');
  if (prev.handle !== next.handle) changed.push('product.handle');
  if (prev.priceAmount !== next.priceAmount) changed.push('product.price');
  if (prev.currencyCode !== next.currencyCode) changed.push('product.currency');
  if (prev.imageUrl !== next.imageUrl) changed.push('product.imageUrl');
  if (prev.wishlisted !== next.wishlisted) changed.push('wishlisted');
  if (prev.marketKey !== next.marketKey) changed.push('marketKey');
  if (prev.pathname !== next.pathname) changed.push('pathname');
  if (prev.returnTo !== next.returnTo) changed.push('returnTo');
  if (prev.className !== next.className) changed.push('className');
  if (prev.imagePriority !== next.imagePriority) changed.push('imagePriority');
  if (prev.gridColumns !== next.gridColumns) changed.push('gridColumns');
  if (prev.tileWidth !== next.tileWidth) changed.push('tileWidth');
  if (prev.perfTraceIndex !== next.perfTraceIndex) changed.push('perfTraceIndex');
  if (prev.perfTraceScreen !== next.perfTraceScreen) changed.push('perfTraceScreen');
  if (prev.disableImageTransition !== next.disableImageTransition) {
    changed.push('disableImageTransition');
  }

  return changed.length ? changed : ['unknown'];
}

function parentPropsChanged(
  prev: ProductCardTraceSnapshot | null,
  next: ProductCardTraceSnapshot,
): boolean {
  if (!prev) return false;
  return (
    prev.className !== next.className ||
    prev.imagePriority !== next.imagePriority ||
    prev.gridColumns !== next.gridColumns ||
    prev.tileWidth !== next.tileWidth ||
    prev.perfTraceIndex !== next.perfTraceIndex ||
    prev.perfTraceScreen !== next.perfTraceScreen ||
    prev.disableImageTransition !== next.disableImageTransition
  );
}

function diffCategories(
  prev: ProductCardTraceSnapshot | null,
  next: ProductCardTraceSnapshot,
): ProductCardDiffCategory[] {
  if (!prev) return ['product'];

  const changed: ProductCardDiffCategory[] = [];

  if (prev.productId !== next.productId || prev.handle !== next.handle) {
    changed.push('product');
  } else if (prev.product !== next.product) {
    changed.push('query_data');
  }

  if (
    prev.priceAmount !== next.priceAmount ||
    prev.currencyCode !== next.currencyCode
  ) {
    changed.push('price');
  }

  if (prev.imageUrl !== next.imageUrl) {
    changed.push('image');
  }

  if (prev.wishlisted !== next.wishlisted) {
    changed.push('wishlist');
  }

  const parentChanged =
    prev.className !== next.className ||
    prev.imagePriority !== next.imagePriority ||
    prev.gridColumns !== next.gridColumns ||
    prev.tileWidth !== next.tileWidth ||
    prev.perfTraceIndex !== next.perfTraceIndex ||
    prev.perfTraceScreen !== next.perfTraceScreen ||
    prev.disableImageTransition !== next.disableImageTransition;

  if (parentChanged) {
    changed.push('parent');
  }

  if (changed.length === 0) {
    changed.push('navigation_state');
  }

  return changed;
}

function mostCommonChange(counts: ChangeCounts): ProductCardDiffCategory | null {
  let best: ProductCardDiffCategory | null = null;
  let bestCount = 0;
  for (const [key, count] of Object.entries(counts) as [ProductCardDiffCategory, number][]) {
    if (count > bestCount) {
      best = key;
      bestCount = count;
    }
  }
  return best;
}

export function recordProductCardRenderDiff(
  props: ProductCardTraceProps,
  prevSnapshot: ProductCardTraceSnapshot | null,
): ProductCardTraceSnapshot {
  const next = snapshotFromProps(props);
  if (!isProductCardDiffTraceActive()) return next;

  const s = ensureSession();
  s.renderCount += 1;
  s.handlesSeen.add(next.handle);

  const changed = diffCategories(prevSnapshot, next);
  for (const category of changed) {
    s.changeCounts[category] += 1;
  }

  const productReferenceChanged = prevSnapshot ? prevSnapshot.product !== next.product : false;
  const wishlistReferenceChanged = prevSnapshot
    ? prevSnapshot.wishlistSetRef !== next.wishlistSetRef
    : false;
  const marketReferenceChanged = prevSnapshot
    ? prevSnapshot.marketKey !== next.marketKey
    : false;
  const parentReferenceChanged = parentPropsChanged(prevSnapshot, next);
  const propsChanged = listPropsChanged(prevSnapshot, next);

  console.log(
    `[PRODUCT_CARD_DIFF] handle=${next.handle} product_reference_changed=${productReferenceChanged} wishlist_reference_changed=${wishlistReferenceChanged} market_reference_changed=${marketReferenceChanged} parent_reference_changed=${parentReferenceChanged} props_changed=${JSON.stringify(propsChanged)}`,
  );

  if (
    propsChanged.length === 1 &&
    propsChanged[0] === 'unknown' &&
    !productReferenceChanged &&
    !wishlistReferenceChanged &&
    !marketReferenceChanged &&
    !parentReferenceChanged
  ) {
    console.log(
      `[PRODUCT_CARD_DIFF_MEMO_BYPASS] handle=${next.handle} memo_props_equal_likely=true internal_hooks=useProductHref,usePrefetchProduct`,
    );
  }

  if (s.renderCount >= 20 && !s.stormReportEmitted) {
    emitProductCardStormReport('render_threshold');
  }

  return next;
}

export function recordCollectionPlpRender(input: {
  screen: 'collection' | 'search';
  reason: string;
  allProducts: Product[] | undefined;
  flatItems: Product[];
  queryDataUpdatedAt?: number;
  isFetching?: boolean;
}): void {
  if (!isProductCardDiffTraceActive()) return;

  const s = ensureSession();
  const productsReferenceChanged =
    prevCollectionProductsRef !== undefined &&
    input.allProducts !== undefined &&
    prevCollectionProductsRef !== input.allProducts;
  const flatReferenceChanged =
    prevFlatItemsRef !== undefined && prevFlatItemsRef !== input.flatItems;
  const queryDataUpdatedAtChanged =
    input.queryDataUpdatedAt !== undefined &&
    prevQueryDataUpdatedAt !== undefined &&
    prevQueryDataUpdatedAt !== input.queryDataUpdatedAt;

  if (productsReferenceChanged) {
    s.collectionReferenceChanges += 1;
    recordProductCardDataSourceChange('collection_products', {
      referenceChanged: true,
      itemCount: input.allProducts?.length ?? 0,
      screen: input.screen,
    });
  }

  if (flatReferenceChanged) {
    recordProductCardDataSourceChange('flat_items', {
      referenceChanged: true,
      itemCount: input.flatItems.length,
      screen: input.screen,
    });
  }

  if (queryDataUpdatedAtChanged) {
    s.queryReferenceChanges += 1;
    recordProductCardDataSourceChange('react_query', {
      referenceChanged: true,
      dataUpdatedAt: input.queryDataUpdatedAt,
      screen: input.screen,
    });
  }

  prevCollectionProductsRef = input.allProducts;
  prevFlatItemsRef = input.flatItems;
  if (input.queryDataUpdatedAt !== undefined) {
    prevQueryDataUpdatedAt = input.queryDataUpdatedAt;
  }

  console.log(
    `[COLLECTION_DATA] screen=${input.screen} products_reference_changed=${productsReferenceChanged} flat_items_reference_changed=${flatReferenceChanged} length=${input.flatItems.length} reason=${input.reason}`,
  );
}

export function recordWishlistMapReferenceChange(handles: string[]): void {
  if (!isProductCardDiffTraceActive()) return;

  const nextSet = new Set(handles);
  const referenceChanged = prevWishlistMapRef !== null && prevWishlistMapRef !== nextSet;
  prevWishlistMapRef = nextSet;

  if (!referenceChanged) return;

  const s = ensureSession();
  s.wishlistReferenceChanges += 1;

  recordProductCardDataSourceChange('wishlist_map', {
    referenceChanged: true,
    itemCount: handles.length,
  });
}

export function recordProductCardDataSourceChange(
  source: 'react_query' | 'collection_products' | 'flat_items' | 'wishlist_map',
  detail: Record<string, unknown>,
): void {
  if (!isProductCardDiffTraceActive()) return;
  console.log('[PRODUCT_CARD_DATA_SOURCE]', `source=${source}`, detail);
}

export function emitProductCardStormReport(trigger: string): void {
  if (!isProductCardDiffTraceEnabled() || !session || session.stormReportEmitted) return;

  session.stormReportEmitted = true;

  console.log(
    `[PRODUCT_CARD_STORM_REPORT] trigger=${trigger} renders=${session.renderCount} unique_products=${session.handlesSeen.size} most_common_change=${mostCommonChange(session.changeCounts)} collection_reference_changes=${session.collectionReferenceChanges} wishlist_reference_changes=${session.wishlistReferenceChanges} query_reference_changes=${session.queryReferenceChanges} change_counts=${JSON.stringify(session.changeCounts)}`,
  );
}

export type { ProductCardTraceSnapshot };
