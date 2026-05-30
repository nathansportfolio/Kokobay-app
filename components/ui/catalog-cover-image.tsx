import { Image, type ImageContentFit, type ImageContentPosition } from 'expo-image';
import { StyleSheet } from 'react-native';

import { catalogImageCache } from '@/constants/expo-image';
import { shopifyCdnUriForPlatform } from '@/utils/shopify-cdn-image';

type Props = {
  uri: string;
  recyclingKey?: string;
  contentFit?: ImageContentFit;
  contentPosition?: ImageContentPosition;
  priority?: 'low' | 'normal' | 'high' | null;
  /** Fade duration (ms) when the image source settles — use on editorial surfaces (e.g. bag). */
  transition?: number | null;
  onLoad?: () => void;
};

/**
 * Remote catalog image with explicit layout. `expo-image` + NativeWind `className` alone often
 * yields 0×0 on native; fill the parent with `absoluteFillObject` (parent must be bounded, e.g.
 * aspect-ratio box, and usually `overflow-hidden` + `relative`).
 */
export function CatalogCoverImage({
  uri,
  recyclingKey,
  contentFit = 'cover',
  contentPosition,
  priority,
  transition,
  onLoad,
}: Props) {
  const resolvedUri = shopifyCdnUriForPlatform(uri);

  return (
    <Image
      source={{ uri: resolvedUri }}
      style={StyleSheet.absoluteFillObject}
      contentFit={contentFit}
      contentPosition={contentPosition}
      recyclingKey={recyclingKey}
      transition={transition ?? undefined}
      onLoad={onLoad}
      {...catalogImageCache}
      priority={priority ?? catalogImageCache.priority}
    />
  );
}
