import { Image } from 'expo-image';
import { Dimensions } from 'react-native';

import { APP_HOME_HERO_QUERY_KEY } from '@/constants/app-home-hero-cms';
import { homeNewInHeroImageUri } from '@/constants/home-hero';
import { getQueryClient } from '@/hooks/use-query-client';
import { fetchAppHomeHero } from '@/services/kokobay-web/app-home-hero';
import { fetchHomeCatalogData } from '@/services/home-catalog';
import { useMarketStore } from '@/store/market-preference';
import { homeHeroDisplayImageUri } from '@/utils/home-hero-image';
import { resolveHomeNewInCollectionHandle } from '@/utils/home-new-in-collection-handle';
import { shopifyCdnUriForPlatform } from '@/utils/shopify-cdn-image';

export const APP_LAUNCH_MIN_DURATION_MS = 600;
export const APP_LAUNCH_FADE_DURATION_MS = 400;

const HOME_CATALOG_STALE_TIME_MS = 4 * 60_000;
const HOME_HERO_STALE_TIME_MS = 30 * 60_000;

function homeCatalogQueryKey(marketKey: string, newInHandle: string) {
  return ['home', 'catalog', marketKey, newInHandle] as const;
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
  async function prefetchHomeHeroImage(): Promise<void> {
    try {
      await queryClient.prefetchQuery({
        queryKey: [...APP_HOME_HERO_QUERY_KEY, marketKey],
        queryFn: ({ signal }) => fetchAppHomeHero(marketKey, { signal }),
        staleTime: HOME_HERO_STALE_TIME_MS,
      });
    } catch {
      /** CMS miss — default hero still prefetched below. */
    }

    const cms = queryClient.getQueryData<Awaited<ReturnType<typeof fetchAppHomeHero>>>([
      ...APP_HOME_HERO_QUERY_KEY,
      marketKey,
    ]);
    const uri = shopifyCdnUriForPlatform(
      cms?.imageUrl ? homeHeroDisplayImageUri(cms.imageUrl, width) : homeNewInHeroImageUri(width),
    );
    await Image.prefetch(uri).catch(() => {});
  }

  await prefetchHomeHeroImage();

  const cms = queryClient.getQueryData<Awaited<ReturnType<typeof fetchAppHomeHero>>>([
    ...APP_HOME_HERO_QUERY_KEY,
    marketKey,
  ]);
  const newInHandle = resolveHomeNewInCollectionHandle(cms?.buttonLink);

  await queryClient
    .prefetchQuery({
      queryKey: homeCatalogQueryKey(marketKey, newInHandle),
      queryFn: () => fetchHomeCatalogData({ newInCollectionHandle: newInHandle }),
      staleTime: HOME_CATALOG_STALE_TIME_MS,
    })
    .catch(() => {
      /** Resolved with error — home error UI renders after reveal. */
    });

  const elapsed = Date.now() - startedAt;
  if (elapsed < APP_LAUNCH_MIN_DURATION_MS) {
    await new Promise<void>((resolve) => {
      setTimeout(resolve, APP_LAUNCH_MIN_DURATION_MS - elapsed);
    });
  }
}
