import { type Href } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { LayoutChangeEvent, View, type ViewStyle } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  type AnimatedStyle,
  clamp,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

import { CatalogCoverImage } from '@/components/ui/catalog-cover-image';
import {
  PRODUCT_QUERY_GC_TIME_MS,
  PRODUCT_QUERY_STALE_TIME_MS,
} from '@/constants/product-query';
import type { ProductPrefetchImageHint } from '@/hooks/use-prefetch-product';
import { useMarketQueryKey } from '@/hooks/use-market-query-key';
import { logCarouselCacheHit } from '@/lib/product-card-gallery-prefetch';
import { logPlpFirstImageLoad } from '@/lib/plp-perf-trace';
import { getProduct } from '@/services/shopify';
import type { Product } from '@/types/shopify';
import { firstValidProductImage } from '@/utils/catalog-image';
import {
  productCardPreviewImages,
  type ProductCardPreviewImage,
} from '@/utils/product-card-preview-images';
import { productQueryKey } from '@/utils/product-query-key';
import { productTileImageUri } from '@/utils/product-tile-image-uri';

const SNAP_MS = 220;
const easeOut = Easing.out(Easing.cubic);
/** Max finger movement still treated as a product tap (not a carousel swipe). */
const TAP_MAX_DISTANCE_PX = 12;
const PAN_ACTIVATE_OFFSET_PX = 14;

type ProductCardImageCarouselProps = {
  product: Product;
  productLink: Href;
  tileWidth?: number;
  imagePriority?: 'low' | 'normal' | 'high' | null;
  disableImageTransition?: boolean;
  perfTraceIndex?: number;
  perfTraceScreen?: string;
  soldOut: boolean;
  usesProgrammaticNav: boolean;
  isVisible?: boolean;
  imagePressStyle: AnimatedStyle<ViewStyle>;
  onPress: () => void;
  onPressIn: () => void;
  onPressOut: () => void;
  onPrefetchProduct?: (handle: string, imageHint?: ProductPrefetchImageHint) => void;
};

function ProductCardImageDots({
  count,
  translateX,
  slideWidth,
}: {
  count: number;
  translateX: SharedValue<number>;
  slideWidth: SharedValue<number>;
}) {
  if (count <= 1) return null;

  return (
    <View
      pointerEvents="none"
      className="absolute bottom-2 left-0 right-0 flex-row items-center justify-center gap-1">
      {Array.from({ length: count }).map((_, index) => (
        <ProductCardImageDot
          key={index}
          index={index}
          translateX={translateX}
          slideWidth={slideWidth}
        />
      ))}
    </View>
  );
}

function ProductCardImageDot({
  index,
  translateX,
  slideWidth,
}: {
  index: number;
  translateX: SharedValue<number>;
  slideWidth: SharedValue<number>;
}) {
  const style = useAnimatedStyle(() => {
    const w = slideWidth.value;
    const page = w > 0 ? Math.round(-translateX.value / w) : 0;
    const active = page === index;
    return {
      opacity: active ? 0.95 : 0.4,
      width: active ? 5 : 4,
      height: active ? 5 : 4,
    };
  });

  return (
    <Animated.View
      style={[
        {
          borderRadius: 3,
          backgroundColor: '#fff',
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.18,
          shadowRadius: 1,
        },
        style,
      ]}
    />
  );
}

function ProductCardImageCarouselInner({
  product,
  tileWidth,
  imagePriority,
  disableImageTransition = true,
  perfTraceIndex,
  perfTraceScreen = 'plp',
  soldOut,
  isVisible = false,
  imagePressStyle,
  onPress,
  onPressIn,
  onPressOut,
  onPrefetchProduct,
}: ProductCardImageCarouselProps) {
  const queryClient = useQueryClient();
  const marketKey = useMarketQueryKey();
  const galleryQueryKey = useMemo(
    () => productQueryKey(product.handle, marketKey),
    [product.handle, marketKey],
  );

  const initialPreviewImages = useMemo(() => productCardPreviewImages(product, 3), [product]);
  const [previewImages, setPreviewImages] =
    useState<ProductCardPreviewImage[]>(initialPreviewImages);
  const [lazyImagesEnabled, setLazyImagesEnabled] = useState(false);
  const [layoutWidth, setLayoutWidth] = useState(0);

  useEffect(() => {
    setPreviewImages(initialPreviewImages);
    setLazyImagesEnabled(false);
  }, [initialPreviewImages, product.id]);

  const applyResolvedGallery = useCallback((resolved: ProductCardPreviewImage[]) => {
    setPreviewImages((prev) => (resolved.length > prev.length ? resolved : prev));
  }, []);

  useLayoutEffect(() => {
    if (!isVisible) return;
    const cached = queryClient.getQueryData<Product>(galleryQueryKey);
    if (!cached) return;
    const resolved = productCardPreviewImages(cached, 3);
    if (resolved.length <= 1) return;
    setPreviewImages((prev) => {
      if (resolved.length <= prev.length) return prev;
      logCarouselCacheHit(product.id, resolved.length);
      return resolved;
    });
  }, [galleryQueryKey, isVisible, product.id, queryClient]);

  const { data: galleryProduct } = useQuery({
    queryKey: galleryQueryKey,
    queryFn: ({ signal }) => getProduct(product.handle, { signal }),
    enabled: isVisible,
    staleTime: PRODUCT_QUERY_STALE_TIME_MS,
    gcTime: PRODUCT_QUERY_GC_TIME_MS,
  });

  useEffect(() => {
    if (!galleryProduct) return;
    applyResolvedGallery(productCardPreviewImages(galleryProduct, 3));
  }, [applyResolvedGallery, galleryProduct]);

  const sourceImage = firstValidProductImage(product);
  const pageCount = previewImages.length;
  const renderCount = lazyImagesEnabled ? pageCount : Math.min(pageCount, 1);
  const carouselEnabled = pageCount > 1 && renderCount > 1;

  const imageUrls = useMemo(
    () =>
      previewImages.map((img) =>
        productTileImageUri({
          url: img.url,
          width: img.width,
          height: img.height,
          tileWidth,
          handle: product.handle,
        }),
      ),
    [previewImages, product.handle, tileWidth],
  );

  const slideWidth = useSharedValue(0);
  const translateX = useSharedValue(0);
  const dragStartX = useSharedValue(0);
  const pageCountShared = useSharedValue(renderCount);

  useEffect(() => {
    pageCountShared.value = renderCount;
    if (renderCount <= 1) {
      translateX.value = 0;
    } else {
      const w = slideWidth.value;
      if (w > 0) {
        const maxPage = renderCount - 1;
        const page = clamp(Math.round(-translateX.value / w), 0, maxPage);
        translateX.value = -page * w;
      }
    }
  }, [pageCountShared, renderCount, slideWidth, translateX]);

  useEffect(() => {
    translateX.value = 0;
    setLazyImagesEnabled(false);
  }, [product.id, translateX]);

  useEffect(() => {
    if (!isVisible || pageCount <= 1 || lazyImagesEnabled) return;
    const frame = requestAnimationFrame(() => {
      setLazyImagesEnabled(true);
    });
    return () => cancelAnimationFrame(frame);
  }, [isVisible, lazyImagesEnabled, pageCount]);

  useEffect(() => {
    if (isVisible) return;
    translateX.value = 0;
  }, [isVisible, translateX]);

  const handleTap = useCallback(() => {
    onPress();
    onPressOut();
  }, [onPress, onPressOut]);

  const onLayout = useCallback(
    (e: LayoutChangeEvent) => {
      const w = e.nativeEvent.layout.width;
      if (w > 0 && w !== layoutWidth) {
        setLayoutWidth(w);
        slideWidth.value = w;
      }
    },
    [layoutWidth, slideWidth],
  );

  const handlePrefetch = useCallback(() => {
    onPrefetchProduct?.(product.handle, sourceImage);
  }, [onPrefetchProduct, product.handle, sourceImage]);

  const handlePressIn = useCallback(() => {
    onPressIn();
    handlePrefetch();
  }, [handlePrefetch, onPressIn]);

  const pan = useMemo(
    () =>
      Gesture.Pan()
        .enabled(carouselEnabled)
        .activeOffsetX([-PAN_ACTIVATE_OFFSET_PX, PAN_ACTIVATE_OFFSET_PX])
        .failOffsetY([-24, 24])
        .onBegin(() => {
          'worklet';
          dragStartX.value = translateX.value;
        })
        .onUpdate((e) => {
          'worklet';
          const count = pageCountShared.value;
          const w = slideWidth.value;
          if (count <= 1 || w <= 0) return;
          const minX = -(count - 1) * w;
          translateX.value = clamp(dragStartX.value + e.translationX, minX, 0);
        })
        .onEnd((e) => {
          'worklet';
          const count = pageCountShared.value;
          const w = slideWidth.value;

          if (count <= 1 || w <= 0) {
            runOnJS(onPressOut)();
            return;
          }

          let page = Math.round(-translateX.value / w);
          if (e.velocityX < -450) page += 1;
          if (e.velocityX > 450) page -= 1;
          page = clamp(page, 0, count - 1);
          translateX.value = withTiming(-page * w, { duration: SNAP_MS, easing: easeOut });
          runOnJS(onPressOut)();
        })
        .onFinalize((_e, success) => {
          if (!success) {
            runOnJS(onPressOut)();
          }
        }),
    [carouselEnabled, dragStartX, onPressOut, pageCountShared, slideWidth, translateX],
  );

  const tap = useMemo(
    () =>
      Gesture.Tap()
        .maxDistance(TAP_MAX_DISTANCE_PX)
        .onBegin(() => {
          runOnJS(handlePressIn)();
        })
        .onEnd(() => {
          runOnJS(handleTap)();
        })
        .onFinalize(() => {
          runOnJS(onPressOut)();
        }),
    [handlePressIn, handleTap, onPressOut],
  );

  const carouselGesture = useMemo(
    () => (carouselEnabled ? Gesture.Exclusive(pan, tap) : tap),
    [carouselEnabled, pan, tap],
  );

  const stripStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  const slidesToRender = previewImages.slice(0, renderCount);

  const firstImage = imageUrls[0] ? (
    <CatalogCoverImage
      uri={imageUrls[0]}
      recyclingKey={`${product.id}-0`}
      priority={imagePriority}
      transition={disableImageTransition ? null : undefined}
      onLoad={
        perfTraceIndex === 0
          ? () => {
              logPlpFirstImageLoad(perfTraceScreen, {
                handle: product.handle,
                productId: product.id,
                imageUrl: imageUrls[0]!,
              });
            }
          : undefined
      }
    />
  ) : null;

  if (!firstImage) {
    return null;
  }

  return (
    <View className="absolute inset-0 overflow-hidden" onLayout={onLayout} collapsable={false}>
      <GestureDetector gesture={carouselGesture}>
        <Animated.View className="absolute inset-0" style={imagePressStyle} collapsable={false}>
          <Animated.View
            style={[
              {
                flexDirection: 'row',
                height: '100%',
                width: layoutWidth > 0 ? layoutWidth * slidesToRender.length : undefined,
              },
              stripStyle,
            ]}
            accessibilityRole="button"
            accessibilityLabel={soldOut ? `${product.title}, no stock` : product.title}>
            {slidesToRender.map((img, index) => {
              const uri = imageUrls[index];
              if (!uri) return null;

              return (
                <View
                  key={img.key}
                  style={{
                    width: layoutWidth > 0 ? layoutWidth : undefined,
                    flex: layoutWidth > 0 ? undefined : 1,
                    height: '100%',
                  }}>
                  <CatalogCoverImage
                    uri={uri}
                    recyclingKey={`${product.id}-${index}`}
                    priority={index === 0 ? imagePriority : 'low'}
                    transition={disableImageTransition ? null : undefined}
                    onLoad={
                      index === 0 && perfTraceIndex === 0
                        ? () => {
                            logPlpFirstImageLoad(perfTraceScreen, {
                              handle: product.handle,
                              productId: product.id,
                              imageUrl: uri,
                            });
                          }
                        : undefined
                    }
                  />
                </View>
              );
            })}
          </Animated.View>
        </Animated.View>
      </GestureDetector>
      <ProductCardImageDots
        count={carouselEnabled ? renderCount : 0}
        translateX={translateX}
        slideWidth={slideWidth}
      />
    </View>
  );
}

function carouselPropsEqual(
  prev: ProductCardImageCarouselProps,
  next: ProductCardImageCarouselProps,
): boolean {
  return (
    prev.product.id === next.product.id &&
    prev.product.handle === next.product.handle &&
    prev.productLink === next.productLink &&
    prev.tileWidth === next.tileWidth &&
    prev.imagePriority === next.imagePriority &&
    prev.disableImageTransition === next.disableImageTransition &&
    prev.perfTraceIndex === next.perfTraceIndex &&
    prev.perfTraceScreen === next.perfTraceScreen &&
    prev.soldOut === next.soldOut &&
    prev.isVisible === next.isVisible &&
    prev.usesProgrammaticNav === next.usesProgrammaticNav &&
    prev.onPress === next.onPress &&
    prev.onPressIn === next.onPressIn &&
    prev.onPressOut === next.onPressOut &&
    prev.onPrefetchProduct === next.onPrefetchProduct
  );
}

export const ProductCardImageCarousel = memo(ProductCardImageCarouselInner, carouselPropsEqual);

ProductCardImageCarousel.displayName = 'ProductCardImageCarousel';
