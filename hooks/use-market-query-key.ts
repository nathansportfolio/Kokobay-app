import { useMarketStore } from '@/store/market-preference';

/** Include in React Query keys so catalog refetches when the shopper changes market. */
export function useMarketQueryKey(): string {
  return useMarketStore((s) => s.countryCode);
}
