import { Image } from 'expo-image';
import { Dimensions } from 'react-native';

import { homeNewInHeroImageUri } from '@/constants/home-hero';
import { shopifyCdnUriForPlatform } from '@/utils/shopify-cdn-image';
import { getQueryClient } from '@/hooks/use-query-client';
import { fetchHomeCatalogData } from '@/services/home-catalog';
import { useMarketStore } from '@/store/market-preference';

export const APP_LAUNCH_MIN_DURATION_MS = 600;
export const APP_LAUNCH_FADE_DURATION_MS = 400;

const HOME_CATALOG_STALE_TIME_MS = 4 * 60_000;

function homeCatalogQueryKey(marketKey: string) {
  return ['home', 'catalog', marketKey] as const;
}

let launchRevealComplete = false;

export function markAppLaunchRevealComplete(): void {
  launchRevealComplete = true;
}

export function isAppLaunchRevealComplete(): boolean {
  return launchRevealComplete;
}

/**
 * Cold-start gate: fonts are loaded; wait for home catalog, hero image, and min splash time.
 */
export async function prepareAppLaunch(screenWidth?: number): Promise<void> {
  const startedAt = Date.now();
  const width = screenWidth ?? Dimensions.get('window').width;
  await useMarketStore.getState().hydrate();
  const marketKey = useMarketStore.getState().countryCode;
  const queryClient = getQueryClient();
  const heroUri = shopifyCdnUriForPlatform(homeNewInHeroImageUri(width));

  await Promise.all([
    queryClient
      .prefetchQuery({
        queryKey: homeCatalogQueryKey(marketKey),
        queryFn: fetchHomeCatalogData,
        staleTime: HOME_CATALOG_STALE_TIME_MS,
      })
      .catch(() => {
        /** Resolved with error — home error UI renders after reveal. */
      }),
    Image.prefetch(heroUri).catch(() => {}),
  ]);

  const elapsed = Date.now() - startedAt;
  if (elapsed < APP_LAUNCH_MIN_DURATION_MS) {
    await new Promise<void>((resolve) => {
      setTimeout(resolve, APP_LAUNCH_MIN_DURATION_MS - elapsed);
    });
  }
}
