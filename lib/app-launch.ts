import { Image } from 'expo-image';
import { Dimensions } from 'react-native';

import { APP_HOME_HERO_QUERY_KEY } from '@/constants/app-home-hero-cms';
import { homeNewInHeroImageUri } from '@/constants/home-hero';
import { getQueryClient } from '@/hooks/use-query-client';
import { fetchAppHomeHero } from '@/services/kokobay-web/app-home-hero';
import { initDeliveryThresholdOnStartup } from '@/services/delivery-threshold';
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

/** Warm launch caches after reveal — never block splash on remote API (Android emulator networking is often 15s+ per fetch). */
function scheduleLaunchWarmup(marketKey: string, screenWidth: number): void {
  const queryClient = getQueryClient();

  void (async () => {
    try {
      await queryClient.prefetchQuery({
        queryKey: [...APP_HOME_HERO_QUERY_KEY, marketKey],
        queryFn: ({ signal }) => fetchAppHomeHero(marketKey, { signal }),
        staleTime: HOME_HERO_STALE_TIME_MS,
      });
    } catch {
      /** Home hero query surfaces error/placeholder after reveal. */
    }

    const cms = queryClient.getQueryData<Awaited<ReturnType<typeof fetchAppHomeHero>>>([
      ...APP_HOME_HERO_QUERY_KEY,
      marketKey,
    ]);
    const heroUri = shopifyCdnUriForPlatform(
      cms?.imageUrl ? homeHeroDisplayImageUri(cms.imageUrl, screenWidth) : homeNewInHeroImageUri(screenWidth),
    );
    await Image.prefetch(heroUri).catch(() => {});

    const newInHandle = resolveHomeNewInCollectionHandle(cms?.buttonLink);
    await queryClient
      .prefetchQuery({
        queryKey: homeCatalogQueryKey(marketKey, newInHandle),
        queryFn: () => fetchHomeCatalogData({ newInCollectionHandle: newInHandle }),
        staleTime: HOME_CATALOG_STALE_TIME_MS,
      })
      .catch(() => {});
  })();

  void initDeliveryThresholdOnStartup();
}

/**
 * Cold-start gate: fonts are loaded; hydrate market + min splash time only.
 * Catalog/hero/delivery load in the background so Android emulators are not stuck on the logo splash.
 */
export async function prepareAppLaunch(screenWidth?: number): Promise<void> {
  const startedAt = Date.now();
  const width = screenWidth ?? Dimensions.get('window').width;
  await useMarketStore.getState().hydrate();
  const marketKey = useMarketStore.getState().countryCode;

  await Image.prefetch(shopifyCdnUriForPlatform(homeNewInHeroImageUri(width))).catch(() => {});

  scheduleLaunchWarmup(marketKey, width);

  const elapsed = Date.now() - startedAt;
  if (elapsed < APP_LAUNCH_MIN_DURATION_MS) {
    await new Promise<void>((resolve) => {
      setTimeout(resolve, APP_LAUNCH_MIN_DURATION_MS - elapsed);
    });
  }
}
