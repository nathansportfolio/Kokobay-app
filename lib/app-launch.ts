import { Image } from 'expo-image';
import { Dimensions } from 'react-native';

import { APP_HOME_HERO_QUERY_KEY } from '@/constants/app-home-hero-cms';
import { homeNewInHeroImageUri } from '@/constants/home-hero';
import { getQueryClient } from '@/hooks/use-query-client';
import { HOME_HERO_STALE_MS } from '@/lib/app-home-hero-query';
import { fetchAppHomeHero } from '@/services/kokobay-web/app-home-hero';
import { getCollectionsCms } from '@/services/kokobay-web/collections-cms';
import { initDeliveryThresholdOnStartup } from '@/src/core/query';
import { fetchHomeCatalogData } from '@/services/home-catalog';
import { homeHeroDisplayImageUri } from '@/utils/home-hero-image';
import { resolveHomeNewInCollectionHandle } from '@/utils/home-new-in-collection-handle';
import { shopifyCdnUriForPlatform } from '@/utils/shopify-cdn-image';

export const APP_LAUNCH_MIN_DURATION_MS = 600;
export const APP_LAUNCH_FADE_DURATION_MS = 400;

const HOME_CATALOG_STALE_TIME_MS = 4 * 60_000;
const COLLECTIONS_CMS_STALE_TIME_MS = 60 * 60_000;

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

/** Warm home caches after Phase B — never block splash on remote API. */
export async function schedulePostRevealWarmup(screenWidth?: number): Promise<void> {
  const width = screenWidth ?? Dimensions.get('window').width;
  const { useMarketStore } = await import('@/store/market-preference');
  const marketKey = useMarketStore.getState().countryCode;
  scheduleLaunchWarmup(marketKey, width);
}

function scheduleLaunchWarmup(marketKey: string, screenWidth: number): void {
  const queryClient = getQueryClient();

  void (async () => {
    try {
      await queryClient.prefetchQuery({
        queryKey: [...APP_HOME_HERO_QUERY_KEY, marketKey],
        queryFn: ({ signal }) => fetchAppHomeHero(marketKey, { signal }),
        staleTime: HOME_HERO_STALE_MS,
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

    await queryClient
      .prefetchQuery({
        queryKey: ['collections-cms'],
        queryFn: ({ signal }) => getCollectionsCms({ signal }),
        staleTime: COLLECTIONS_CMS_STALE_TIME_MS,
      })
      .catch(() => {});
  })();

  void initDeliveryThresholdOnStartup();
}

/**
 * Cold-start gate: fonts loaded + min splash time + local hero fallback prefetch.
 * Auth (Phase A), market/cart (Phase B), and services (Phase C) run via BootstrapManager.
 */
export async function prepareAppLaunch(screenWidth?: number): Promise<void> {
  const startedAt = Date.now();
  const width = screenWidth ?? Dimensions.get('window').width;

  await Image.prefetch(shopifyCdnUriForPlatform(homeNewInHeroImageUri(width))).catch(() => {});

  const elapsed = Date.now() - startedAt;
  if (elapsed < APP_LAUNCH_MIN_DURATION_MS) {
    await new Promise<void>((resolve) => {
      setTimeout(resolve, APP_LAUNCH_MIN_DURATION_MS - elapsed);
    });
  }
}
