import { useMemo } from 'react';
import { Pressable, View } from 'react-native';

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
 * PDP carousel slide — image + tap only so horizontal swipes are not blocked.
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

  if (!uri) {
    return <View style={[{ flex: 1, backgroundColor: palette.surface }, { width, height }]} />;
  }

  return (
    <Pressable
      style={{ width, height }}
      onPress={() => onImagePress?.(slideIndex)}
      accessibilityRole="button"
      accessibilityLabel="Open product images"
      className="bg-surface">
      <CatalogCoverImage
        uri={displayUri}
        recyclingKey={recyclingKey ?? displayUri}
        contentFit="cover"
        priority="high"
        transition={null}
      />
    </Pressable>
  );
}
