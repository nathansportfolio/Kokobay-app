import Carousel, { type ICarouselInstance } from 'react-native-reanimated-carousel';
import { useMemo, useRef } from 'react';
import { useWindowDimensions, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, type SharedValue } from 'react-native-reanimated';

import { pdpGalleryHeight } from '@/constants/pdp-layout';
import { PDP_CAROUSEL_SCROLL_MS } from '@/constants/luxury-motion';
import { palette } from '@/constants/theme';
import { AppErrorBoundary } from '@/components/ui/error-boundary';
import type { Image } from '@/types/shopify';
import { isLikelyRemoteImageUrl } from '@/utils/catalog-image';
import { hapticSelection } from '@/utils/haptics';

import { PdpImageCarouselFallback } from './pdp-image-carousel-fallback';
import { PdpZoomableSlide } from './pdp-zoomable-slide';

export type PdpImageCarouselProps = {
  images: Image[];
  onImagePress?: (index: number) => void;
};

function PdpCarouselProgressBar({
  progress,
  count,
  trackWidth,
}: {
  progress: SharedValue<number>;
  count: number;
  trackWidth: number;
}) {
  const fillStyle = useAnimatedStyle(() => {
    if (count <= 1) {
      return { width: trackWidth };
    }
    const denom = count - 1;
    const w = trackWidth * (progress.value / denom);
    return { width: Math.max(4, w) };
  });

  return (
    <View className="pointer-events-none absolute bottom-6 left-0 right-0 items-center">
      <View
        style={{
          width: trackWidth,
          height: 2,
          borderRadius: 2,
          backgroundColor: 'rgba(0,0,0,0.07)',
          overflow: 'hidden',
        }}>
        <Animated.View
          style={[
            {
              height: '100%',
              borderRadius: 2,
              backgroundColor: palette.ink,
            },
            fillStyle,
          ]}
        />
      </View>
    </View>
  );
}

function PdpImageCarouselInner({ images, onImagePress }: PdpImageCarouselProps) {
  const { width, height: winH } = useWindowDimensions();
  const galleryH = pdpGalleryHeight(width, winH);
  const progress = useSharedValue(0);
  const carouselRef = useRef<ICarouselInstance>(null);
  const skipFirstSnapHaptic = useRef(true);

  const carouselImages = useMemo(() => {
    const seen = new Set<string>();
    return images.filter((im) => {
      if (!isLikelyRemoteImageUrl(im.url)) return false;
      const k = im.id ?? im.url;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  }, [images]);

  const data =
    carouselImages.length > 0
      ? carouselImages
      : [{ id: 'placeholder', url: '', altText: null, width: null, height: null }];

  const trackW = Math.min(200, width - 56);

  if (!width || galleryH < 1) {
    return <View className="relative bg-surface" style={{ width: width || 1, height: Math.max(galleryH, 1) }} />;
  }

  return (
    <View className="relative bg-surface">
      <Carousel
        ref={carouselRef}
        width={width}
        height={galleryH}
        data={data}
        loop={false}
        autoFillData={false}
        pagingEnabled
        overscrollEnabled={false}
        scrollAnimationDuration={PDP_CAROUSEL_SCROLL_MS}
        onConfigurePanGesture={(pan) => {
          pan.activeOffsetX([-14, 14]);
          pan.failOffsetY([-12, 12]);
        }}
        onProgressChange={progress}
        onSnapToItem={() => {
          if (skipFirstSnapHaptic.current) {
            skipFirstSnapHaptic.current = false;
            return;
          }
          hapticSelection();
        }}
        renderItem={({ item, index }) => (
          <PdpZoomableSlide
            uri={item.url ?? ''}
            sourceWidth={item.width}
            sourceHeight={item.height}
            width={width}
            height={galleryH}
            slideIndex={index}
            recyclingKey={item.id ?? item.url ?? String(index)}
            onImagePress={onImagePress}
          />
        )}
      />
      {carouselImages.length > 1 ? (
        <PdpCarouselProgressBar progress={progress} count={carouselImages.length} trackWidth={trackW} />
      ) : null}
    </View>
  );
}

export function PdpImageCarousel(props: PdpImageCarouselProps) {
  return (
    <AppErrorBoundary
      name="Product gallery"
      fallback={<PdpImageCarouselFallback {...props} />}>
      <PdpImageCarouselInner {...props} />
    </AppErrorBoundary>
  );
}
