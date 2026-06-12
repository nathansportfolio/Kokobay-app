import { useMemo } from 'react';
import { View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';

import { CatalogCoverImage } from '@/components/ui/catalog-cover-image';
import { palette } from '@/constants/theme';
import { productPdpGalleryImageUri } from '@/utils/product-pdp-image-uri';

export type PdpZoomableSlideProps = {
  uri: string;
  sourceWidth?: number | null;
  sourceHeight?: number | null;
  width: number;
  height: number;
  slideIndex: number;
  recyclingKey?: string;
  /** Single tap opens fullscreen gallery (pinch-zoom lives in the lightbox). */
  onImagePress?: (slideIndex: number) => void;
};

/**
 * PDP carousel slide — RNGH tap only so horizontal pans reach the carousel.
 * Pinch/double-tap zoom is available in `PdpImageLightbox` via `ZoomableImage`.
 */
export function PdpZoomableSlide({
  uri,
  sourceWidth,
  sourceHeight,
  width,
  height,
  slideIndex,
  recyclingKey,
  onImagePress,
}: PdpZoomableSlideProps) {
  const displayUri = useMemo(
    () =>
      uri
        ? productPdpGalleryImageUri({
            url: uri,
            width: sourceWidth,
            height: sourceHeight,
            screenWidth: width,
          })
        : '',
    [uri, sourceWidth, sourceHeight, width],
  );

  const tapGesture = useMemo(() => {
    if (!onImagePress) return null;
    return Gesture.Tap()
      .maxDuration(320)
      .onEnd(() => {
        'worklet';
        runOnJS(onImagePress)(slideIndex);
      });
  }, [onImagePress, slideIndex]);

  if (!uri) {
    return <View style={[{ flex: 1, backgroundColor: palette.surface }, { width, height }]} />;
  }

  const slide = (
    <View style={{ width, height }} className="bg-surface" accessibilityRole="button" accessibilityLabel="Open product images">
      <CatalogCoverImage
        uri={displayUri}
        recyclingKey={recyclingKey ?? displayUri}
        contentFit="cover"
        priority="high"
        transition={null}
      />
    </View>
  );

  if (!tapGesture) {
    return slide;
  }

  return <GestureDetector gesture={tapGesture}>{slide}</GestureDetector>;
}
