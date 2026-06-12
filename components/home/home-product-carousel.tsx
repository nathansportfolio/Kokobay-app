import { memo, useMemo } from 'react';
import { ScrollView, type StyleProp, type ViewStyle } from 'react-native';

import type { Product } from '@/types/shopify';

import { HomeProductTile, type HomeProductTileSelectItemContext } from './home-product-tile';

type Props = {
  products: Product[];
  tileWidth: number;
  /** Extra end padding so the last card can scroll off slightly (e.g. search peek). */
  contentPaddingEnd?: number;
  /** Passed through to each tile (e.g. search overlay dismiss + navigate). */
  onProductPress?: (handle: string) => void;
  selectItemContext?: HomeProductTileSelectItemContext;
};

function HomeProductCarouselInner({
  products,
  tileWidth,
  contentPaddingEnd = 0,
  onProductPress,
  selectItemContext,
}: Props) {
  const contentStyle = useMemo<StyleProp<ViewStyle>>(
    () => ({
      paddingLeft: 0,
      paddingRight: contentPaddingEnd,
      paddingBottom: 8,
    }),
    [contentPaddingEnd],
  );

  if (!products.length) {
    return null;
  }

  /** ScrollView — small horizontal strips inside parent FlashList / ScrollView (no nested FlashList). */
  return (
    <ScrollView
      horizontal
      nestedScrollEnabled
      showsHorizontalScrollIndicator={false}
      decelerationRate="fast"
      keyboardShouldPersistTaps="handled"
      style={{ flex: 1 }}
      contentContainerStyle={contentStyle}>
      {products.map((item, index) => (
        <HomeProductTile
          key={`${item.handle}:${item.id}`}
          product={item}
          width={tileWidth}
          index={index}
          onProductPress={onProductPress}
          selectItemContext={selectItemContext}
        />
      ))}
    </ScrollView>
  );
}

export const HomeProductCarousel = memo(HomeProductCarouselInner);
