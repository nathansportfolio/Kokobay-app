import { useQuery } from '@tanstack/react-query';
import { BlurView } from 'expo-blur';
import { Plus } from 'lucide-react-native';
import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import Animated, {
  FadeIn,
  FadeInDown,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PdpSizeSelector } from '@/components/pdp/pdp-size-selector';
import { Button } from '@/components/ui/button';
import {
  LUXURY_CARD_ACTION_ICON_COLOR,
  LuxuryCardActionSurface,
} from '@/components/ui/luxury-card-action-surface';
import { Text } from '@/components/ui/text';
import { useBagActions } from '@/contexts/bag-context';
import { useBackInStockSubscription } from '@/hooks/use-back-in-stock-subscription';
import { useBackInStockAlertEmail } from '@/hooks/use-back-in-stock-alert-email';
import { useBackInStockPrefillEmail } from '@/hooks/use-back-in-stock-prefill-email';
import { usePrefetchProduct } from '@/hooks/use-prefetch-product';
import { useMarketQueryKey } from '@/hooks/use-market-query-key';
import { trackQuickAddToBagClicked, trackQuickAddToBagModalShown } from '@/lib/gtm';
import { getProduct } from '@/services/shopify';
import {
  subscribeBackInStock,
  variantTitleForBackInStock,
} from '@/services/kokobay-web/back-in-stock';
import { getAuthAccessToken } from '@/src/core/auth/token';
import { useAuth } from '@/hooks/use-auth';
import type { Product } from '@/types/shopify';
import { imageUrlForCartLine, variantLabelForCart } from '@/utils/cart-display';
import { resolveVariantQuantityCap } from '@/utils/cart-inventory';
import { cn } from '@/utils/cn';
import { hapticLight, hapticSuccess } from '@/utils/haptics';
import { showBackInStockResultToast, deferBackInStockToast } from '@/utils/back-in-stock-toast';
import { formatMoney } from '@/utils/money';
import { isCatalogPreviewProduct, isProductFullySoldOut } from '@/utils/product-availability';
import { getProductSizeOptions, getVariantForSize, isSizeAvailable } from '@/utils/pdp-variants';
import { PRODUCT_CARD_FOOTER_CTA_BLOCK } from '@/constants/product-card-typography';
import type { ProductCardActionScale } from '@/utils/product-card-action-scale';
import {
  PRODUCT_QUERY_GC_TIME_MS,
  PRODUCT_QUERY_STALE_TIME_MS,
} from '@/constants/product-query';
import { productQueryKey } from '@/utils/product-query-key';
import { yieldForUiPaint } from '@/utils/yield-for-ui-paint';

const BLUR_OVERLAY = Platform.OS === 'ios';
const PLUS_ICON = { strokeWidth: 1.75 as const };
const BACK_IN_STOCK_INPUT_CLASS =
  'border border-line bg-surface px-4 py-3.5 font-sans text-[15px] text-ink rounded-sm';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
/** Space between size row and primary CTA — calm editorial rhythm */
const CTA_SECTION_MARGIN_TOP = 48;

export type QuickAddTrigger = 'overlay_plus' | 'footer_button';

export type QuickAddToBagProps = {
  product: Product;
  relaxed?: boolean;
  /** When set, sizes the overlay plus from tile width (preferred over `relaxed`). */
  actionScale?: ProductCardActionScale;
  triggerClassName?: string;
  /** @default 'overlay_plus' */
  trigger?: QuickAddTrigger;
  buttonClassName?: string;
};

type QuickAddToBagSheetProps = {
  product: Product;
  relaxed?: boolean;
  onClose: () => void;
};

function QuickAddToBagSheet({ product, onClose }: QuickAddToBagSheetProps) {
  const insets = useSafeAreaInsets();
  const marketKey = useMarketQueryKey();
  const { addToBag } = useBagActions();
  const [addingToBag, setAddingToBag] = useState(false);
  const [notifySubmitting, setNotifySubmitting] = useState(false);
  const [notifyEmail, setNotifyEmail] = useState('');
  const [notifyError, setNotifyError] = useState<string | null>(null);
  const [selectedSize, setSelectedSize] = useState<string | null>(null);
  const { user } = useAuth();
  const customerEmail = user?.email;
  const customerId = user?.id;
  const isLoggedIn = Boolean(customerEmail?.trim());

  const needsFullProduct = isCatalogPreviewProduct(product);
  const { data: loadedProduct, isPending: loadingProduct } = useQuery({
    queryKey: productQueryKey(product.handle, marketKey),
    queryFn: ({ signal }) => getProduct(product.handle, { signal }),
    enabled: needsFullProduct,
    staleTime: PRODUCT_QUERY_STALE_TIME_MS,
    gcTime: PRODUCT_QUERY_GC_TIME_MS,
  });

  const activeProduct = loadedProduct ?? product;
  const variantsLoading = needsFullProduct && loadingProduct && !loadedProduct;

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
    onClose();
    setNotifyError(null);
  }, [onClose]);

  useEffect(() => {
    setSelectedSize(null);
  }, [product.handle]);

  useEffect(() => {
    trackQuickAddToBagModalShown({ product });
  }, [product]);

  useEffect(() => {
    if (variantsLoading) return;
    if (sizeOptions.length === 0) {
      setSelectedSize(null);
      return;
    }
    const first =
      sizeOptions.find((s) => isSizeAvailable(activeProduct, s)) ?? sizeOptions[0] ?? null;
    setSelectedSize(first);
  }, [activeProduct, sizeOptions, variantsLoading]);

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

  const backInStockPrefillEmail = useBackInStockPrefillEmail({
    variantId: selectedVariant?.id,
    customerEmail,
    enabled: showBackInStockCta,
  });

  const backInStockAlertEmail = useBackInStockAlertEmail({
    variantId: selectedVariant?.id,
    customerEmail,
  });

  const { subscribed: backInStockSubscribed, markSubscribed: markBackInStockSubscribed } =
    useBackInStockSubscription({
      variantId: selectedVariant?.id,
      email: backInStockAlertEmail,
      customerId,
      enabled: showBackInStockCta && Boolean(selectedVariant?.id) && Boolean(backInStockAlertEmail),
    });

  useEffect(() => {
    if (!showBackInStockCta) return;
    setNotifyEmail(backInStockPrefillEmail);
    setNotifyError(null);
  }, [showBackInStockCta, backInStockPrefillEmail, selectedVariant?.id]);

  const backInStockCtaLabel = backInStockSubscribed
    ? 'We will email you when back in stock'
    : 'Notify me when back in stock';

  const backInStockButtonTitle = backInStockSubscribed ? 'Done' : backInStockCtaLabel;

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
      onClose();
    } finally {
      setAddingToBag(false);
    }
  }, [activeProduct, addToBag, addingToBag, canAdd, onClose, selectedVariant]);

  const onNotifyBackInStock = useCallback(async () => {
    if (!selectedVariant || notifySubmitting) return;

    if (backInStockSubscribed) {
      onClose();
      deferBackInStockToast(() =>
        showBackInStockResultToast({ ok: true, alreadySubscribed: true }),
      );
      return;
    }

    const trimmedEmail = (isLoggedIn ? customerEmail : notifyEmail)?.trim() ?? '';
    if (!trimmedEmail) {
      setNotifyError('Enter your email address.');
      return;
    }

    setNotifyError(null);
    setNotifySubmitting(true);
    if (__DEV__) {
      console.log('[back-in-stock] quick-add submit', {
        handle: activeProduct.handle,
        variantId: selectedVariant.id,
        isLoggedIn,
        hasEmail: Boolean(trimmedEmail),
      });
    }
    try {
      const result = await subscribeBackInStock(
        {
          email: trimmedEmail,
          productHandle: activeProduct.handle,
          variantId: selectedVariant.id,
          productTitle: activeProduct.title,
          variantTitle: variantTitleForBackInStock(selectedVariant),
        },
        { sessionToken: getAuthAccessToken(), customerId },
      );
      if (__DEV__) {
        console.log('[back-in-stock] quick-add result', {
          ok: result.ok,
          ...(result.ok ? {} : { error: result.error }),
        });
      }
      if (!result.ok) {
        setNotifyError(result.error);
        return;
      }
      hapticSuccess();
      markBackInStockSubscribed();
      onClose();
      deferBackInStockToast(() => showBackInStockResultToast(result));
    } finally {
      setNotifySubmitting(false);
    }
  }, [
    activeProduct.handle,
    activeProduct.title,
    backInStockSubscribed,
    customerEmail,
    customerId,
    isLoggedIn,
    markBackInStockSubscribed,
    notifyEmail,
    notifySubmitting,
    onClose,
    selectedVariant,
  ]);

  const sizeScrollTall = sizeOptions.length > 9;
  const sheetBottomPad = Math.max(insets.bottom, 28);

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
    <Modal visible animationType="fade" transparent statusBarTranslucent onRequestClose={close}>
      <KeyboardAvoidingView
        className="flex-1 justify-end"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
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

            {showBackInStockCta && !backInStockSubscribed ? (
              <View style={{ marginTop: 28 }}>
                <Text variant="body" className="mb-4 text-[15px] leading-6 text-muted">
                  {isLoggedIn
                    ? `We will email ${customerEmail?.trim()} when this size is back in stock.`
                    : 'Enter your email and we will let you know when this size is back.'}
                </Text>
                {!isLoggedIn ? (
                  <>
                    <Text variant="label" className="mb-2 text-mist">
                      Email
                    </Text>
                    <TextInput
                      autoCapitalize="none"
                      autoCorrect={false}
                      keyboardType="email-address"
                      textContentType="emailAddress"
                      autoComplete="email"
                      value={notifyEmail}
                      onChangeText={setNotifyEmail}
                      editable={!notifySubmitting}
                      placeholder="you@example.com"
                      placeholderTextColor="#71717A"
                      className={BACK_IN_STOCK_INPUT_CLASS}
                    />
                  </>
                ) : null}
                {notifyError ? (
                  <Text variant="caption" className="mt-2 text-accentSoft">
                    {notifyError}
                  </Text>
                ) : null}
              </View>
            ) : null}

            {showBackInStockCta && backInStockSubscribed ? (
              <Text variant="body" className="mt-6 text-[15px] leading-6 text-muted">
                {backInStockAlertEmail
                  ? `We will email ${backInStockAlertEmail} when this size is back in stock.`
                  : 'We will email you when this size is back in stock.'}
              </Text>
            ) : null}

            <View style={{ marginTop: CTA_SECTION_MARGIN_TOP }}>
              <Button
                title={showBackInStockCta ? backInStockButtonTitle : 'Add to bag'}
                variant="primary"
                loading={addingToBag || notifySubmitting}
                disabled={addingToBag || notifySubmitting || (!showBackInStockCta && !canAdd)}
                onPress={showBackInStockCta ? () => void onNotifyBackInStock() : onAdd}
              />
            </View>
          </Animated.View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function useQuickAddToBagSheet(product: Product) {
  const prefetchProduct = usePrefetchProduct();
  const [open, setOpen] = useState(false);

  const openSheet = useCallback(() => {
    hapticLight();
    trackQuickAddToBagClicked({ product });
    prefetchProduct(product.handle);
    setOpen(true);
  }, [prefetchProduct, product]);

  const closeSheet = useCallback(() => setOpen(false), []);

  const sheet = open ? <QuickAddToBagSheet product={product} onClose={closeSheet} /> : null;

  return { openSheet, sheet };
}

function QuickAddToBagInner({
  product,
  relaxed,
  actionScale,
  triggerClassName,
  trigger = 'overlay_plus',
  buttonClassName,
}: QuickAddToBagProps) {
  const { openSheet, sheet } = useQuickAddToBagSheet(product);
  const triggerPressed = useSharedValue(0);
  const triggerPressStyle = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(triggerPressed.value, [0, 1], [1, 0.94]) }],
    opacity: interpolate(triggerPressed.value, [0, 1], [1, 0.9]),
  }));

  const soldOut = isProductFullySoldOut(product);
  const overlayAction = actionScale ?? {
    surfaceSize: relaxed ? 'md' : 'sm',
    iconSize: relaxed ? 18 : 16,
    inset: relaxed ? 16 : 12,
  } as ProductCardActionScale;

  if (soldOut && trigger !== 'footer_button') {
    return null;
  }

  if (trigger === 'footer_button') {
    const cta = PRODUCT_CARD_FOOTER_CTA_BLOCK;
    const footerTitle = soldOut ? 'Notify me' : 'Add to bag';
    return (
      <>
        <View
          className="w-full"
          style={{
            paddingTop: cta.paddingTop,
            paddingBottom: cta.paddingBottom,
            paddingHorizontal: cta.paddingHorizontal,
          }}>
          <Button
            title={footerTitle}
            variant="primary"
            accessibilityLabel={
              soldOut
                ? `Get back in stock alerts for ${product.title}`
                : `Choose size and add ${product.title} to bag`
            }
            className={cn('min-h-[32px] w-full rounded-none px-3 py-1', buttonClassName)}
            textClassName="text-[11px] tracking-wide"
            onPress={openSheet}
          />
        </View>
        {sheet}
      </>
    );
  }

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
        onPress={openSheet}
        className={triggerClassName}
        style={[
          {
            position: 'absolute',
            bottom: overlayAction.inset,
            left: overlayAction.inset,
            zIndex: 10,
          },
          triggerPressStyle,
        ]}>
        <LuxuryCardActionSurface size={overlayAction.surfaceSize}>
          <Plus
            size={overlayAction.iconSize}
            color={LUXURY_CARD_ACTION_ICON_COLOR}
            {...PLUS_ICON}
          />
        </LuxuryCardActionSurface>
      </AnimatedPressable>

      {sheet}
    </>
  );
}

export const QuickAddToBag = memo(QuickAddToBagInner);
