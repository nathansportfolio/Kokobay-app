import { useMemo } from 'react';
import { ScrollView, useWindowDimensions, View } from 'react-native';

import { pdpGalleryHeight } from '@/constants/pdp-layout';
import type { Image } from '@/types/shopify';
import { isLikelyRemoteImageUrl } from '@/utils/catalog-image';

import { PdpZoomableSlide, type PdpZoomableSlideProps } from './pdp-zoomable-slide';

export type PdpImageCarouselFallbackProps = {
  images: Image[];
  onImagePress?: PdpZoomableSlideProps['onImagePress'];
};

/**
 * Plain horizontal pager — used when Reanimated Carousel throws so PDP still loads.
 */
export function PdpImageCarouselFallback({ images, onImagePress }: PdpImageCarouselFallbackProps) {
  const { width, height: winH } = useWindowDimensions();
  const galleryH = pdpGalleryHeight(width, winH);

  const slides = useMemo(() => {
    const seen = new Set<string>();
    return images.filter((im) => {
      if (!isLikelyRemoteImageUrl(im.url)) return false;
      const k = im.id ?? im.url;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  }, [images]);

  if (!width || galleryH < 1) {
    return <View className="bg-surface" style={{ width: width || 1, height: Math.max(galleryH, 1) }} />;
  }

  if (!slides.length) {
    return <View className="bg-surface" style={{ width, height: galleryH }} />;
  }

  return (
    <ScrollView
      horizontal
      pagingEnabled
      showsHorizontalScrollIndicator={false}
      bounces={slides.length > 1}
      nestedScrollEnabled
      directionalLockEnabled
      style={{ width, height: galleryH }}
      contentContainerStyle={{ height: galleryH }}>
      {slides.map((item, index) => (
        <PdpZoomableSlide
          key={item.id ?? item.url ?? String(index)}
          uri={item.url ?? ''}
          sourceWidth={item.width}
          sourceHeight={item.height}
          width={width}
          height={galleryH}
          slideIndex={index}
          recyclingKey={item.id ?? item.url ?? String(index)}
          onImagePress={onImagePress}
        />
      ))}
    </ScrollView>
  );
}
