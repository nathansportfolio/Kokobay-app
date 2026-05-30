import { useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Skeleton } from '@/components/ui/skeleton';
import { pdpGalleryHeight } from '@/constants/pdp-layout';
import { luxuryHeaderTotalHeight } from '@/constants/luxury-nav';
import { useAppErrorBannerChromeHeight } from '@/hooks/use-app-error-banner-content';

export function ProductDetailSkeleton() {
  const insets = useSafeAreaInsets();
  const { width, height: winH } = useWindowDimensions();
  const appErrorBannerHeight = useAppErrorBannerChromeHeight();
  const chromeTop = luxuryHeaderTotalHeight(insets.top, appErrorBannerHeight);
  const galleryH = pdpGalleryHeight(width, winH);

  return (
    <View className="flex-1 bg-canvas">
      <View style={{ height: chromeTop }} pointerEvents="none" />
      <View className="bg-surface">
        <Skeleton className="w-full rounded-none" style={{ height: galleryH }} />
        <View className="items-center py-5">
          <Skeleton className="h-0.5 w-[52%] max-w-[200px] rounded-full" />
        </View>
      </View>
      <View className="px-6">
        <Skeleton className="mb-5 h-3 w-24" />
        <Skeleton className="mb-4 h-9 w-[88%]" />
        <Skeleton className="mb-11 h-3 w-32" />
        <View className="mb-10 flex-row flex-wrap gap-2.5">
          <Skeleton className="h-11 w-14 rounded-full" />
          <Skeleton className="h-11 w-14 rounded-full" />
          <Skeleton className="h-11 w-14 rounded-full" />
          <Skeleton className="h-11 w-14 rounded-full" />
        </View>
        <Skeleton className="mb-10 h-12 w-36 rounded-full" />
        <Skeleton className="mb-8 h-4 w-40" />
        <Skeleton className="mb-5 h-3 w-full" />
        <Skeleton className="mb-5 h-3 w-[92%]" />
        <Skeleton className="mb-8 h-3 w-[70%]" />
        <Skeleton className="mb-5 h-3 w-32" />
        <Skeleton className="mb-5 h-3 w-full" />
        <Skeleton className="h-3 w-[85%]" />
      </View>
    </View>
  );
}
