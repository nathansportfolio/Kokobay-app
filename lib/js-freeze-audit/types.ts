export type JsFreezeRenderStormLabel =
  | 'ProductCard'
  | 'Home'
  | 'Product'
  | 'Cart'
  | 'CheckoutBar'
  | 'BottomTabs';

export const JS_FREEZE_RENDER_STORM_LABELS: JsFreezeRenderStormLabel[] = [
  'ProductCard',
  'Home',
  'Product',
  'Cart',
  'CheckoutBar',
  'BottomTabs',
];

export type ResumeTimelineEvent =
  | 'resume_start'
  | 'query_refetch_start'
  | 'query_refetch_end'
  | 'store_update'
  | 'cart_sync_start'
  | 'cart_sync_end'
  | 'render_complete';

export type LongTaskEntry = {
  name: string;
  durationMs: number;
};

export type StoreUpdateEntry = {
  store: string;
  changedKeys: string[];
  durationMs: number;
};
