import type { ForegroundNetworkSource } from '@/lib/foreground-audit/network-source';

export type ForegroundRenderLabel =
  | 'Home'
  | 'Collection'
  | 'Product'
  | 'Cart'
  | 'CheckoutBar'
  | 'BottomTabs'
  | 'Header'
  | 'ProductCard';

export type ForegroundTransition = 'inactive->active' | 'background->active';

export type ForegroundNetworkEntry = {
  url: string;
  method: string;
  durationMs: number;
  source: ForegroundNetworkSource;
};

export type ForegroundQueryEntry = {
  key: string;
  refetch: boolean;
  durationMs: number;
  reason: string;
};

export type ForegroundStoreEntry = {
  store: string;
  changedKeys: string[];
  atMs: number;
};

export type ForegroundCartEntry = {
  event: string;
  reason?: string;
  kind?: string;
  detail?: Record<string, unknown>;
  atMs: number;
};

export type ForegroundRenderCounts = Record<ForegroundRenderLabel, number>;

export const FOREGROUND_RENDER_LABELS: ForegroundRenderLabel[] = [
  'Home',
  'Collection',
  'Product',
  'Cart',
  'CheckoutBar',
  'BottomTabs',
  'Header',
  'ProductCard',
];

export function emptyForegroundRenderCounts(): ForegroundRenderCounts {
  return {
    Home: 0,
    Collection: 0,
    Product: 0,
    Cart: 0,
    CheckoutBar: 0,
    BottomTabs: 0,
    Header: 0,
    ProductCard: 0,
  };
}
