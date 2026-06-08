import { useQuery } from '@tanstack/react-query';

import { fetchAppContent } from '@/services/kokobay-web/app-content';
import { cmsQueryKeys } from '@/src/core/query/query-keys';
import { isKokobayWebProductsConfigured } from '@/services/kokobay-web/client';
import { useMarketStore } from '@/store/market-preference';
import type { AppContent, UseAppContentResult } from '@/types/app-content';
import { getShopifyCountryCode } from '@/services/shopify/market-context';
import { shopifyRichTextHasContent } from '@/utils/shopify-rich-text';

const APP_CONTENT_STALE_MS = 30 * 60_000;

function resolveCountryCode(countryCode?: string): string {
  const fromArg = countryCode?.trim().toUpperCase();
  if (fromArg) return fromArg;
  return getShopifyCountryCode();
}

export function appContentHasBody(input: {
  content: string;
  richContent?: unknown;
}): boolean {
  if (shopifyRichTextHasContent(input.richContent)) return true;
  return Boolean(input.content.trim());
}

type UseAppContentOptions = {
  /** Shorter stale window + refetch when app returns to foreground (global banner). */
  live?: boolean;
  /** Omit `?country=` — used for global incident banner (`app_error`). */
  omitCountry?: boolean;
};

export function useAppContent(
  slug: string,
  countryCode?: string,
  options?: UseAppContentOptions,
): UseAppContentResult {
  const storeCountry = useMarketStore((s) => s.countryCode);
  const country = options?.omitCountry
    ? ''
    : resolveCountryCode(countryCode ?? storeCountry);
  const safeSlug = slug.trim();
  const enabled = Boolean(safeSlug) && isKokobayWebProductsConfigured();
  const live = options?.live === true;

  const query = useQuery<AppContent | null>({
    queryKey: cmsQueryKeys.content(safeSlug, country),
    enabled,
    staleTime: live ? 60_000 : APP_CONTENT_STALE_MS,
    gcTime: 60 * 60_000,
    refetchOnWindowFocus: live,
    refetchOnReconnect: live,
    placeholderData: (previous) => previous,
    queryFn: ({ signal }) => fetchAppContent(safeSlug, country, { signal }),
  });

  const data = query.data ?? null;

  return {
    title: data?.title?.trim() ?? '',
    content: data?.content?.trim() ?? '',
    richContent: data?.richContent,
    loading: enabled && query.isPending,
    error: query.isError ? 'unavailable' : undefined,
  };
}
