import { useRef } from 'react';

type HomeRenderSnapshot = {
  isPending: boolean;
  isError: boolean;
  hasData: boolean;
  isRefetching: boolean;
  cmsTilesCount: number;
  appErrorBannerHeight: number;
  width: number;
  newInHandle: string;
  heroPending: boolean;
};

function diffHomeRenderReasons(
  prev: HomeRenderSnapshot | null,
  next: HomeRenderSnapshot,
): string {
  if (!prev) return 'mount';
  const reasons: string[] = [];
  if (prev.isPending !== next.isPending) reasons.push('catalog_pending');
  if (prev.isError !== next.isError) reasons.push('catalog_error');
  if (prev.hasData !== next.hasData) reasons.push('catalog_data');
  if (prev.isRefetching !== next.isRefetching) reasons.push('catalog_refetch');
  if (prev.cmsTilesCount !== next.cmsTilesCount) reasons.push('cms_tiles');
  if (prev.appErrorBannerHeight !== next.appErrorBannerHeight) reasons.push('banner_chrome');
  if (prev.width !== next.width) reasons.push('window_width');
  if (prev.newInHandle !== next.newInHandle) reasons.push('new_in_handle');
  if (prev.heroPending !== next.heroPending) reasons.push('hero_query');
  return reasons.length ? reasons.join(',') : 'unknown';
}

/** Dev-only — logs `[HOME_RENDER]` with the subscription that changed. */
export function useHomeRenderTrace(snapshot: HomeRenderSnapshot): void {
  if (!__DEV__) return;
  const prevRef = useRef<HomeRenderSnapshot | null>(null);
  const reason = diffHomeRenderReasons(prevRef.current, snapshot);
  console.log('[HOME_RENDER]', `reason=${reason}`);
  prevRef.current = snapshot;
}
