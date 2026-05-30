import { useQuery } from '@tanstack/react-query';
import { BlurView } from 'expo-blur';
import { Plus } from 'lucide-react-native';
import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Modal, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, {
  FadeIn,
  FadeInDown,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PdpBackInStockSheet } from '@/components/pdp/pdp-back-in-stock-sheet';
import { PdpSizeSelector } from '@/components/pdp/pdp-size-selector';
import { Button } from '@/components/ui/button';
import {
  LUXURY_CARD_ACTION_ICON_COLOR,
  LuxuryCardActionSurface,
} from '@/components/ui/luxury-card-action-surface';
import { Text } from '@/components/ui/text';
import { useBagActions } from '@/contexts/bag-context';
import { useBackInStockSubscription } from '@/hooks/use-back-in-stock-subscription';
import { usePrefetchProduct } from '@/hooks/use-prefetch-product';
import { useMarketQueryKey } from '@/hooks/use-market-query-key';
import { getProduct } from '@/services/shopify';
import { useAuthStore } from '@/store';
import type { Product } from '@/types/shopify';
import { imageUrlForCartLine, variantLabelForCart } from '@/utils/cart-display';
import { resolveVariantQuantityCap } from '@/utils/cart-inventory';
import { cn } from '@/utils/cn';
import { hapticLight, hapticSuccess } from '@/utils/haptics';
import { formatMoney } from '@/utils/money';
import { isCatalogPreviewProduct, isProductFullySoldOut } from '@/utils/product-availability';
import { getProductSizeOptions, getVariantForSize, isSizeAvailable } from '@/utils/pdp-variants';
import {
  PRODUCT_QUERY_GC_TIME_MS,
  PRODUCT_QUERY_STALE_TIME_MS,
} from '@/constants/product-query';
import { productQueryKey } from '@/utils/product-query-key';
import { yieldForUiPaint } from '@/utils/yield-for-ui-paint';

const BLUR_OVERLAY = Platform.OS === 'ios';
const PLUS_ICON = { strokeWidth: 1.75 as const };
const PLUS_SIZE = 18;

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
/** Space between size row and primary CTA — calm editorial rhythm */
const CTA_SECTION_MARGIN_TOP = 48;

export type QuickAddToBagProps = {
  product: Product;
  relaxed?: boolean;
  triggerClassName?: string;
};

function QuickAddToBagInner({ product, relaxed, triggerClassName }: QuickAddToBagProps) {
  const insets = useSafeAreaInsets();
  const marketKey = useMarketQueryKey();
  const { addToBag } = useBagActions();
  const prefetchProduct = usePrefetchProduct();
  const [open, setOpen] = useState(false);
  const [addingToBag, setAddingToBag] = useState(false);
  const [backInStockOpen, setBackInStockOpen] = useState(false);
  const [selectedSize, setSelectedSize] = useState<string | null>(null);
  const customerEmail = useAuthStore((s) => s.user?.email);
  const customerId = useAuthStore((s) => s.user?.id);
  const sessionToken = useAuthStore((s) => s.accessToken);
  const triggerPressed = useSharedValue(0);
  const triggerPressStyle = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(triggerPressed.value, [0, 1], [1, 0.94]) }],
    opacity: interpolate(triggerPressed.value, [0, 1], [1, 0.9]),
  }));

  const needsFullProduct = isCatalogPreviewProduct(product);
  const { data: loadedProduct, isPending: loadingProduct } = useQuery({
    queryKey: productQueryKey(product.handle, marketKey),
    queryFn: ({ signal }) => getProduct(product.handle, { signal }),
    enabled: open && needsFullProduct,
    staleTime: PRODUCT_QUERY_STALE_TIME_MS,
    gcTime: PRODUCT_QUERY_GC_TIME_MS,
  });

  const activeProduct = loadedProduct ?? product;
  const variantsLoading = open && needsFullProduct && loadingProduct && !loadedProduct;

  const soldOut = isProductFullySoldOut(product);
  const sizeOptions = useMemo(() => getProductSizeOptions(activeProduct), [activeProduct]);
  const sizeAvailability = useMemo(() => {
    if (sizeOptions.length === 0) return undefined;
    const map: Record<string, boolean> = {};
    for (const s of sizeOptions) {
      map[s] = isSizeAvailable(activeProduct, s);
    }
    return map;
  }, [activeProduct, sizeOptions]);

  const close = useCallback(() => {
    setOpen(false);
    setBackInStockOpen(false);
  }, []);

  useEffect(() => {
    setSelectedSize(null);
  }, [product.handle]);

  useEffect(() => {
    if (!open || variantsLoading) return;
    if (sizeOptions.length === 0) {
      setSelectedSize(null);
      return;
    }
    const first =
      sizeOptions.find((s) => isSizeAvailable(activeProduct, s)) ?? sizeOptions[0] ?? null;
    setSelectedSize(first);
  }, [open, activeProduct, sizeOptions, variantsLoading]);

  const sizeValue = selectedSize ?? sizeOptions[0] ?? null;

  const selectedVariant = useMemo(() => {
    if (sizeOptions.length === 0) {
      return (
        activeProduct.variants.find((v) => v.availableForSale) ?? activeProduct.variants[0]
      );
    }
    if (!sizeValue) return activeProduct.variants[0];
    return getVariantForSize(activeProduct, sizeValue) ?? activeProduct.variants[0];
  }, [activeProduct, sizeOptions.length, sizeValue]);

  const priceLabel = selectedVariant
    ? formatMoney(selectedVariant.price)
    : formatMoney(activeProduct.priceRange.minVariantPrice);

  const canAdd = !variantsLoading && Boolean(selectedVariant?.availableForSale);
  const showBackInStockCta = !variantsLoading && Boolean(selectedVariant) && !canAdd;

  const { subscribed: backInStockSubscribed, markSubscribed: markBackInStockSubscribed } =
    useBackInStockSubscription({
      variantId: selectedVariant?.id,
      email: customerEmail,
      customerId,
      sessionToken: sessionToken ?? undefined,
      enabled:
        open && showBackInStockCta && Boolean(customerEmail?.trim() && selectedVariant?.id),
    });

  const backInStockCtaLabel = backInStockSubscribed
    ? 'We will email you when back in stock'
    : 'Email me when back in stock';

  const onAdd = useCallback(async () => {
    if (!selectedVariant || !canAdd || addingToBag) return;
    setAddingToBag(true);
    try {
      await yieldForUiPaint();
      await addToBag({
        handle: activeProduct.handle,
        variantId: selectedVariant.id,
        qty: 1,
        title: activeProduct.title,
        variantTitle: variantLabelForCart(selectedVariant),
        imageUrl: imageUrlForCartLine(activeProduct, selectedVariant) ?? null,
        unitPrice: selectedVariant.price,
        quantityAvailable: resolveVariantQuantityCap(selectedVariant),
      });
      hapticSuccess();
      setOpen(false);
    } finally {
      setAddingToBag(false);
    }
  }, [activeProduct, addToBag, addingToBag, canAdd, selectedVariant]);

  const onBackInStock = useCallback(() => {
    if (!selectedVariant) return;
    hapticLight();
    setBackInStockOpen(true);
  }, [selectedVariant]);

  const actionSize = relaxed ? 'md' : 'sm';

  const sizeScrollTall = sizeOptions.length > 9;
  const sheetBottomPad = Math.max(insets.bottom, 28);

  if (soldOut) {
    return null;
  }

  const sizeBlock = variantsLoading ? (
    <View className="min-h-[88px] items-center justify-center py-6">
      <ActivityIndicator color="#6E5E4F" />
    </View>
  ) : sizeOptions.length > 0 ? (
    <PdpSizeSelector
      sizes={sizeOptions}
      value={sizeValue ?? ''}
      onChange={(s) => setSelectedSize(s)}
      disabled={false}
      sizeAvailable={sizeAvailability}
      embedBottom
    />
  ) : (
    <View className="mb-1">
      <Text variant="label" className="mb-4 text-[11px] uppercase tracking-[0.2em] text-muted">
        Size
      </Text>
      <Text className="font-sans text-[15px] leading-[22px] tracking-[-0.1px] text-ink">
        {selectedVariant ? variantLabelForCart(selectedVariant) : 'One size'}
      </Text>
    </View>
  );

  return (
    <>
      <AnimatedPressable
        accessibilityRole="button"
        accessibilityLabel={`Quick add ${product.title} to bag`}
        hitSlop={10}
        onPressIn={() => {
          triggerPressed.value = withTiming(1, { duration: 100 });
        }}
        onPressOut={() => {
          triggerPressed.value = withTiming(0, { duration: 200 });
        }}
        onPress={() => {
          hapticLight();
          prefetchProduct(product.handle);
          setOpen(true);
        }}
        className={cn('absolute bottom-4 left-4 z-10', triggerClassName)}
        style={triggerPressStyle}>
        <LuxuryCardActionSurface size={actionSize}>
          <Plus size={PLUS_SIZE} color={LUXURY_CARD_ACTION_ICON_COLOR} {...PLUS_ICON} />
        </LuxuryCardActionSurface>
      </AnimatedPressable>

      <Modal visible={open} animationType="fade" transparent statusBarTranslucent onRequestClose={close}>
        <View className="flex-1 justify-end">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Dismiss"
            onPress={close}
            style={{ flex: 1 }}
            className="w-full">
            <Animated.View entering={FadeIn.duration(260)} style={StyleSheet.absoluteFill}>
              {BLUR_OVERLAY ? (
                <BlurView intensity={36} tint="dark" style={StyleSheet.absoluteFill} />
              ) : null}
              <View
                style={[
                  StyleSheet.absoluteFill,
                  {
                    backgroundColor: BLUR_OVERLAY ? 'rgba(10, 8, 6, 0.32)' : 'rgba(0, 0, 0, 0.48)',
                  },
                ]}
              />
            </Animated.View>
          </Pressable>

          <Animated.View
            entering={FadeInDown.duration(300).delay(12)}
            className="w-full overflow-hidden rounded-t-[28px] border-t border-line/30 bg-warmCanvas"
            style={{
              paddingBottom: sheetBottomPad,
              paddingHorizontal: 28,
              paddingTop: 32,
              maxWidth: '100%',
            }}>
            <View className="mb-7 h-1.5 w-12 self-center rounded-full bg-black/[0.1]" />

            <Text
              className="mb-2 font-sans-md text-[16px] leading-[22px] tracking-[-0.2px] text-ink"
              numberOfLines={3}>
              {activeProduct.title}
            </Text>
            <Text className="mb-8 font-sans text-[14px] leading-5 tracking-wide text-mist">{priceLabel}</Text>

            {sizeScrollTall ? (
              <ScrollView
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
                style={{ maxHeight: 200 }}
                className="mb-0">
                {sizeBlock}
              </ScrollView>
            ) : (
              <View className="mb-0">{sizeBlock}</View>
            )}

            <View style={{ marginTop: CTA_SECTION_MARGIN_TOP }}>
              <Button
                title={showBackInStockCta ? backInStockCtaLabel : 'Add to bag'}
                variant="primary"
                loading={addingToBag}
                disabled={addingToBag || (!showBackInStockCta && !canAdd)}
                onPress={showBackInStockCta ? onBackInStock : onAdd}
              />
            </View>
          </Animated.View>
        </View>
      </Modal>

      {selectedVariant ? (
        <PdpBackInStockSheet
          visible={backInStockOpen}
          onClose={() => setBackInStockOpen(false)}
          product={activeProduct}
          variant={selectedVariant}
          customerEmail={customerEmail ?? undefined}
          customerId={customerId}
          sessionToken={sessionToken ?? undefined}
          onSubscribed={() => {
            markBackInStockSubscribed();
            setOpen(false);
            setBackInStockOpen(false);
          }}
        />
      ) : null}
    </>
  );
}

export const QuickAddToBag = memo(QuickAddToBagInner);
