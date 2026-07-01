import { useNavigation } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import { Redirect, type ErrorBoundaryProps, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, ScrollView, useWindowDimensions, View } from 'react-native';

import { PdpAccordion } from '@/components/pdp/pdp-accordion';
import { PdpBackInStockSheet } from '@/components/pdp/pdp-back-in-stock-sheet';
import { PdpImageLightbox } from '@/components/pdp/pdp-image-lightbox';
import { PdpImageCarousel } from '@/components/pdp/pdp-image-carousel';
import { PdpQtyStepper } from '@/components/pdp/pdp-qty-stepper';
import { PdpRelatedProducts } from '@/components/pdp/pdp-related-products';
import { PdpRelatedProductsSkeleton } from '@/components/pdp/pdp-related-products-skeleton';
import { PdpSizeGuideModal } from '@/components/pdp/pdp-size-guide-modal';
import { PdpSizeSelector } from '@/components/pdp/pdp-size-selector';
import { Button } from '@/components/ui/button';
import { AppErrorBoundary } from '@/components/ui/error-boundary';
import { EmptyState } from '@/components/ui/empty-state';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { ProductDetailSkeleton } from '@/components/ui/product-detail-skeleton';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { PdpProductInfoSections } from '@/components/pdp/pdp-product-info-sections';
import { ProductFitWidget } from '@/components/product/product-fit-widget';
import { useChrome, useFloatingBottomPadding } from '@/contexts/chrome-context';
import { useBindScrollToTop } from '@/contexts/scroll-to-top-context';
import { useBagActions } from '@/contexts/bag-context';
import { useIsWishlistedHandle, useWishlistToggle } from '@/contexts/wishlist-context';
import { palette } from '@/constants/theme';
import { usePdpGoBack } from '@/hooks/use-pdp-go-back';
import { useProductQueryCleanup } from '@/hooks/use-product-query-cleanup';
import { useLifecycleRenderCount } from '@/hooks/use-lifecycle-render-count';
import { useMarketQueryKey } from '@/hooks/use-market-query-key';
import { useRenderTrace } from '@/hooks/use-render-trace';
import { useScreenLoadTrace } from '@/hooks/use-screen-load-trace';
import { useSizeGuideQuery } from '@/hooks/use-size-guide-query';
import { trackViewItem } from '@/lib/gtm';
import { getProductRecommendations } from '@/services/product-recommendations';
import { recordProductPageView } from '@/services/kokobay-web/page-views';
import { getProduct } from '@/services/shopify';
import { useAuth } from '@/hooks/use-auth';
import { useBackInStockSubscription } from '@/hooks/use-back-in-stock-subscription';
import { useBackInStockAlertEmail } from '@/hooks/use-back-in-stock-alert-email';
import { imageUrlForCartLine, variantLabelForCart } from '@/utils/cart-display';
import { resolveVariantQuantityCap } from '@/utils/cart-inventory';
import { isLikelyRemoteImageUrl } from '@/utils/catalog-image';
import { showBackInStockResultToast, deferBackInStockToast } from '@/utils/back-in-stock-toast';
import { hapticLight, hapticSuccess } from '@/utils/haptics';
import { formatMoney, parseMoneyAmount } from '@/utils/money';
import { productPdpLightboxImageUri } from '@/utils/product-pdp-image-uri';
import { prefetchPdpGalleryForProduct } from '@/utils/product-pdp-image-prefetch';
import { prefetchProductTileImages } from '@/utils/product-tile-image-prefetch';
import {
  PRODUCT_QUERY_GC_TIME_MS,
  PRODUCT_QUERY_STALE_TIME_MS,
} from '@/constants/product-query';
import { productQueryKey } from '@/utils/product-query-key';
import { HOME_TAB_HREF } from '@/utils/collection-navigation';
import { yieldForUiPaint } from '@/utils/yield-for-ui-paint';
import { getProductSizeOptions, getVariantForSize, findVariantById, isSizeAvailable } from '@/utils/pdp-variants';
import { stripSimpleHtml } from '@/utils/strip-html';

const PDP_QUESTIONS_EMAIL = 'info@kokobay.co.uk';
const CTA_FG = '#FFFFFF';

export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  return (
    <Screen scroll className="bg-canvas">
      <View className="px-5 pt-16">
        <EmptyState
          title="Product unavailable"
          message={__DEV__ ? error.message : 'Something went wrong loading this product. Please try again.'}>
          <Button title="Try again" variant="primary" onPress={retry} />
        </EmptyState>
      </View>
    </Screen>
  );
}

export default function ProductScreen() {
  useLifecycleRenderCount('product');
  useRenderTrace('Product');
  const { handle, returnTo, variantId } = useLocalSearchParams<{
    handle: string;
    returnTo?: string;
    variantId?: string;
  }>();
  const navigation = useNavigation();
  const goBack = usePdpGoBack();
  const { width: screenWidth } = useWindowDimensions();
  const tabBarBottomPad = useFloatingBottomPadding();
  const { topChromeHeight: chromeTop } = useChrome();
  const pdpTopSpacer = chromeTop;
  const pdpBackTop = chromeTop + 8;
  const { addToBag } = useBagActions();
  const safeHandle = typeof handle === 'string' ? handle : '';
  const toggleWishlist = useWishlistToggle();
  const saved = useIsWishlistedHandle(safeHandle);
  const deepLinkVariantId = typeof variantId === 'string' ? variantId.trim() : '';
  const preservedReturnTo = typeof returnTo === 'string' ? returnTo.trim() : '';
  const marketKey = useMarketQueryKey();
  useProductQueryCleanup();

  const productQueryKeyValue = productQueryKey(safeHandle, marketKey);

  const { data: product, isPending, isFetching, isError, refetch } = useQuery({
    queryKey: productQueryKeyValue,
    enabled: Boolean(safeHandle),
    staleTime: PRODUCT_QUERY_STALE_TIME_MS,
    gcTime: PRODUCT_QUERY_GC_TIME_MS,
    queryFn: async ({ signal }) => {
      if (!safeHandle) return null;
      return getProduct(safeHandle, { signal });
    },
  });

  /** Never render PDP content until cache data matches the route handle (avoids previous-product flicker). */
  const displayProduct = product?.handle === safeHandle ? product : undefined;
  const productReady = Boolean(displayProduct);
  useSizeGuideQuery(productReady);
  const showProductSkeleton = Boolean(safeHandle) && !displayProduct && !isError;

  const sizeOptions = useMemo(
    () => (displayProduct ? getProductSizeOptions(displayProduct) : []),
    [displayProduct],
  );
  const sizeAvailability = useMemo(() => {
    if (!displayProduct || sizeOptions.length === 0) return undefined;
    const map: Record<string, boolean> = {};
    for (const s of sizeOptions) map[s] = isSizeAvailable(displayProduct, s);
    return map;
  }, [displayProduct, sizeOptions]);

  const [selectedSize, setSelectedSize] = useState<string | null>(null);
  const [qty, setQty] = useState(1);
  const [addingToBag, setAddingToBag] = useState(false);
  const [lightbox, setLightbox] = useState<{ open: boolean; index: number }>({ open: false, index: 0 });
  const [backInStockOpen, setBackInStockOpen] = useState(false);
  const [sizeGuideOpen, setSizeGuideOpen] = useState(false);
  const { user } = useAuth();
  const customerEmail = user?.email;
  const customerId = user?.id;

  const scrollRef = useRef<ScrollView>(null);
  const viewItemTrackedRef = useRef<string | null>(null);
  const pageViewTrackedRef = useRef<string | null>(null);

  useLayoutEffect(() => {
    viewItemTrackedRef.current = null;
    pageViewTrackedRef.current = null;
    setSelectedSize(null);
    setQty(1);
    setLightbox({ open: false, index: 0 });
    setBackInStockOpen(false);
    setSizeGuideOpen(false);
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }, [safeHandle]);

  useEffect(() => {
    if (!displayProduct) return;
    prefetchPdpGalleryForProduct(displayProduct, { screenWidth });
  }, [displayProduct, screenWidth]);

  useEffect(() => {
    if (!displayProduct) return;
    const opts = getProductSizeOptions(displayProduct);

    if (deepLinkVariantId) {
      const matched = findVariantById(displayProduct, deepLinkVariantId);
      if (matched) {
        const size = matched.selectedOptions.find((o) => o.name.toLowerCase() === 'size')?.value;
        if (size && opts.includes(size)) {
          setSelectedSize(size);
          setQty(1);
          return;
        }
      }
    }

    const firstAvailable = opts.find((s) => isSizeAvailable(displayProduct, s));
    setSelectedSize((prev) => {
      if (prev && opts.includes(prev)) return prev;
      return firstAvailable ?? opts[0] ?? null;
    });
    setQty(1);
  }, [displayProduct, deepLinkVariantId]);

  const selectedVariant = useMemo(() => {
    if (!displayProduct) return undefined;
    if (deepLinkVariantId && !selectedSize) {
      const matched = findVariantById(displayProduct, deepLinkVariantId);
      if (matched && getProductSizeOptions(displayProduct).length === 0) {
        return matched;
      }
    }
    if (!selectedSize) return displayProduct.variants[0];
    return getVariantForSize(displayProduct, selectedSize) ?? displayProduct.variants[0];
  }, [displayProduct, selectedSize, deepLinkVariantId]);

  const canAdd = Boolean(selectedVariant?.availableForSale);
  const showBackInStockCta = Boolean(selectedVariant) && !canAdd;

  useEffect(() => {
    if (!displayProduct) return;
    const key = `${displayProduct.handle}::${selectedVariant?.id ?? 'default'}`;
    if (viewItemTrackedRef.current === key) return;
    viewItemTrackedRef.current = key;
    trackViewItem({ product: displayProduct, variant: selectedVariant });
  }, [displayProduct, selectedVariant]);

  useEffect(() => {
    if (!displayProduct) return;
    const email = customerEmail?.trim();
    if (!email) return;
    const handleKey = displayProduct.handle;
    if (pageViewTrackedRef.current === handleKey) return;
    pageViewTrackedRef.current = handleKey;
    recordProductPageView(email, handleKey);
  }, [displayProduct, customerEmail]);

  const { data: related = [], isPending: relatedPending, isFetching: relatedFetching } = useQuery({
    queryKey: ['product-recommendations', safeHandle, 'related', marketKey],
    enabled: productReady,
    staleTime: 5 * 60_000,
    gcTime: PRODUCT_QUERY_GC_TIME_MS,
    queryFn: async () => {
      if (!displayProduct) return [];
      return getProductRecommendations(displayProduct, { intent: 'related', limit: 8 });
    },
  });

  const relatedProducts = displayProduct ? related : [];

  useEffect(() => {
    if (!relatedProducts.length) return;
    const itemW = Math.min(200, Math.round(screenWidth * 0.42));
    prefetchProductTileImages(relatedProducts, { tileWidth: itemW, limit: 8 });
  }, [relatedProducts, screenWidth]);

  const galleryUris = useMemo(() => {
    if (!displayProduct) return [];
    return displayProduct.images
      .filter((im) => isLikelyRemoteImageUrl(im.url))
      .map((im) =>
        productPdpLightboxImageUri({
          url: im.url,
          width: im.width,
          height: im.height,
          screenWidth,
          handle: displayProduct.handle,
        }),
      );
  }, [displayProduct, screenWidth]);

  const openImageLightbox = useCallback(
    (index: number) => {
      if (!galleryUris.length) return;
      const i = Math.min(Math.max(0, index), galleryUris.length - 1);
      setLightbox({ open: true, index: i });
    },
    [galleryUris],
  );
  const closeImageLightbox = useCallback(() => setLightbox((s) => ({ ...s, open: false })), []);

  useLayoutEffect(() => {
    const title = displayProduct?.title ?? '';
    navigation.setOptions({ headerShown: false, title });
    return () => navigation.setOptions({ headerShown: true });
  }, [navigation, displayProduct?.title]);

  const descriptionBody = useMemo(() => {
    if (!displayProduct) return '';
    if (displayProduct.description) return displayProduct.description;
    if (displayProduct.descriptionHtml) return stripSimpleHtml(displayProduct.descriptionHtml);
    return '';
  }, [displayProduct]);

  const onAddToCart = useCallback(async () => {
    if (!displayProduct || !selectedVariant || addingToBag) return;
    setAddingToBag(true);
    try {
      await yieldForUiPaint();
      await addToBag({
        handle: displayProduct.handle,
        variantId: selectedVariant.id,
        qty,
        title: displayProduct.title,
        variantTitle: variantLabelForCart(selectedVariant),
        imageUrl: imageUrlForCartLine(displayProduct, selectedVariant) ?? null,
        unitPrice: selectedVariant.price,
        quantityAvailable: resolveVariantQuantityCap(selectedVariant),
      });
      hapticSuccess();
    } finally {
      setAddingToBag(false);
    }
  }, [addToBag, addingToBag, displayProduct, selectedVariant, qty]);

  const onToggleWishlist = useCallback(() => {
    if (!displayProduct) return;
    toggleWishlist(displayProduct.handle);
    hapticLight();
  }, [displayProduct, toggleWishlist]);


  const openAskQuestionEmail = useCallback(() => {
    const subject = encodeURIComponent(`Question — ${displayProduct?.title ?? 'Product'}`);
    Linking.openURL(`mailto:${PDP_QUESTIONS_EMAIL}?subject=${subject}`).catch(() => {});
  }, [displayProduct?.title]);

  const backInStockAlertEmail = useBackInStockAlertEmail({
    variantId: selectedVariant?.id,
    customerEmail,
  });

  const { subscribed: backInStockSubscribed, markSubscribed: markBackInStockSubscribed } = useBackInStockSubscription({
    variantId: selectedVariant?.id,
    email: backInStockAlertEmail,
    customerId,
    enabled: showBackInStockCta && Boolean(selectedVariant?.id) && Boolean(backInStockAlertEmail),
  });

  const onBackInStock = useCallback(() => {
    if (!displayProduct || !selectedVariant) return;
    hapticLight();
    if (backInStockSubscribed) {
      deferBackInStockToast(() =>
        showBackInStockResultToast({ ok: true, alreadySubscribed: true }),
      );
      return;
    }
    setBackInStockOpen(true);
  }, [backInStockSubscribed, displayProduct, selectedVariant]);

  const [pdpScrollEnabled, setPdpScrollEnabled] = useState(true);
  const onGalleryScrollStart = useCallback(() => setPdpScrollEnabled(false), []);
  const onGalleryScrollEnd = useCallback(() => setPdpScrollEnabled(true), []);

  const scrollToTopPdp = useCallback(() => {
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  }, []);
  const { onScroll: onPdpScroll } = useBindScrollToTop(scrollToTopPdp, Boolean(safeHandle && productReady && !isError));

  let renderBranch = 'content';
  if (!safeHandle) renderBranch = 'missing-handle';
  else if (showProductSkeleton) renderBranch = 'skeleton';
  else if (isError || !displayProduct) renderBranch = 'error';

  useScreenLoadTrace({
    screen: 'product',
    routeKey: safeHandle || 'missing-handle',
    showSkeleton: renderBranch === 'skeleton',
    showContent: renderBranch === 'content',
    branch: renderBranch,
    extra: {
      productReady,
      showProductSkeleton,
      isPending,
      isFetching,
      productHandle: product?.handle ?? null,
    },
    queries: [
      {
        key: `["product","${safeHandle}"]`,
        isPending,
        isFetching,
        isError,
        dataUndefined: product === undefined,
        enabled: Boolean(safeHandle),
      },
      {
        key: `["product-recommendations","${safeHandle}","related"]`,
        isPending: relatedPending,
        isFetching: relatedFetching,
        isError: false,
        dataUndefined: relatedPending && relatedProducts.length === 0,
        enabled: productReady,
      },
    ],
  });

  if (!safeHandle) {
    return <Redirect href={HOME_TAB_HREF} />;
  }

  if (showProductSkeleton) {
    return (
      <ScrollView key={`skeleton-${safeHandle}`} className="flex-1 bg-canvas" contentContainerStyle={{ flexGrow: 1 }}>
        <ProductDetailSkeleton />
      </ScrollView>
    );
  }

  if (isError || !displayProduct) {
    return (
      <ScrollView key={`error-${safeHandle}`} className="flex-1 bg-canvas" contentContainerStyle={{ flexGrow: 1, paddingTop: 16, paddingBottom: 48 }}>
        <View className="px-5">
          <EmptyState title="Product unavailable" message={`We could not load “${String(handle)}”. Your saved catalog will be used when available.`}>
            <Button title="Try again" variant="primary" onPress={() => void refetch()} />
          </EmptyState>
        </View>
      </ScrollView>
    );
  }

  const unitMoney = selectedVariant
    ? selectedVariant.price
    : displayProduct.priceRange.minVariantPrice;
  const priceLabel = formatMoney(unitMoney);
  const addToBagPriceLabel =
    qty > 1
      ? formatMoney({
          amount: (parseMoneyAmount(unitMoney) * qty).toFixed(2),
          currencyCode: unitMoney.currencyCode,
        })
      : priceLabel;
  const compareAtPrice = selectedVariant?.compareAtPrice;
  const showCompare = Boolean(
    selectedVariant &&
      compareAtPrice &&
      Number.parseFloat(compareAtPrice.amount) > Number.parseFloat(selectedVariant.price.amount),
  );

  const stickyCtaStripHeight = 6 + 50 + 8;
  const stickyBottomPad = stickyCtaStripHeight + tabBarBottomPad;
  const ctaBottomPad = tabBarBottomPad;
  const backInStockCtaLabel = backInStockSubscribed ? 'We will email you when back in stock' : 'Email me when back in stock';

  return (
    <View key={safeHandle} className="flex-1 bg-canvas">
      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        nestedScrollEnabled
        directionalLockEnabled
        scrollEnabled={pdpScrollEnabled}
        removeClippedSubviews={false}
        contentContainerStyle={{ paddingBottom: stickyBottomPad }}
        bounces
        onScroll={onPdpScroll}
        scrollEventThrottle={16}>
        <View className="relative">
          <View style={{ height: pdpTopSpacer }} pointerEvents="none" />
          <AppErrorBoundary
            name="Product gallery"
            fallback={({ retry }) => (
              <View className="bg-surface px-5 py-16">
                <EmptyState title="Gallery unavailable" message="Images could not be shown for this product.">
                  <Button title="Retry gallery" variant="secondary" onPress={retry} />
                </EmptyState>
              </View>
            )}>
            <PdpImageCarousel
              key={safeHandle}
              images={displayProduct.images}
              onImagePress={openImageLightbox}
              onScrollGestureStart={onGalleryScrollStart}
              onScrollGestureEnd={onGalleryScrollEnd}
            />
          </AppErrorBoundary>
          <Pressable
            onPress={goBack}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            className="absolute z-10 rounded-full bg-white/78 p-2.5 active:opacity-88"
            style={{ top: pdpBackTop, left: 14 }}>
            <IconSymbol name="chevron.left" size={22} color={palette.ink} />
          </Pressable>
        </View>

        <View className="px-6 pt-11">
          <View className="mb-5 flex-row items-center justify-between gap-3">
            <View className="min-w-0 flex-1 flex-row flex-wrap items-baseline gap-3">
              <Text variant="label" className="text-[19px] text-accent">
                {priceLabel}
              </Text>
              {showCompare && compareAtPrice ? (
                <Text variant="caption" className="text-muted line-through">
                  {formatMoney(compareAtPrice)}
                </Text>
              ) : null}
            </View>
            <Pressable
              onPress={onToggleWishlist}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel={saved ? 'Remove from wishlist' : 'Add to wishlist'}
              accessibilityState={{ selected: saved }}
              className="shrink-0 p-1 active:opacity-70">
              <IconSymbol
                name={saved ? 'heart.fill' : 'heart'}
                size={22}
                color={saved ? palette.accent : palette.ink}
                weight="regular"
              />
            </Pressable>
          </View>

          <Text variant="display" className="mb-4 text-[28px] leading-[34px] tracking-[-0.02em] text-ink">
            {displayProduct.title}
          </Text>

          {displayProduct.vendor ? (
            <Text variant="caption" className="mb-11 text-[12px] uppercase tracking-[0.18em] text-muted">
              {displayProduct.vendor}
              {displayProduct.productType ? ` · ${displayProduct.productType}` : ''}
            </Text>
          ) : (
            <View className="mb-11" />
          )}

          <PdpSizeSelector
            sizes={sizeOptions}
            value={selectedSize ?? sizeOptions[0] ?? ''}
            onChange={setSelectedSize}
            sizeAvailable={sizeAvailability}
            onOpenSizeGuide={() => setSizeGuideOpen(true)}
          />
          <View className="mt-2">
            <PdpQtyStepper value={qty} onChange={setQty} disabled={!canAdd} />
          </View>

          <ProductFitWidget fitData={displayProduct.fitData} />

          <View className="mt-10">
            <PdpAccordion title="Description" defaultOpen={false}>
              <Text variant="body" className="text-[15px] leading-7 text-muted">
                {descriptionBody || 'Details for this piece will appear here.'}
              </Text>
            </PdpAccordion>
            <PdpProductInfoSections />
            <PdpAccordion title="Ask a question">
              <Text variant="body" className="text-[15px] leading-7 text-muted">
                For any questions please email{' '}
                <Text
                  variant="body"
                  className="text-[15px] leading-7 text-accent underline"
                  accessibilityRole="link"
                  accessibilityLabel={`Email ${PDP_QUESTIONS_EMAIL}`}
                  onPress={openAskQuestionEmail}>
                  {PDP_QUESTIONS_EMAIL}
                </Text>
              </Text>
            </PdpAccordion>
          </View>

          {relatedPending && relatedProducts.length === 0 ? (
            <PdpRelatedProductsSkeleton />
          ) : (
            <PdpRelatedProducts
              products={relatedProducts}
              returnTo={preservedReturnTo || undefined}
            />
          )}
        </View>
      </ScrollView>

      {lightbox.open ? (
        <AppErrorBoundary name="Image viewer">
          <PdpImageLightbox visible uris={galleryUris} initialIndex={lightbox.index} onClose={closeImageLightbox} />
        </AppErrorBoundary>
      ) : null}

      {selectedVariant ? (
        <PdpBackInStockSheet
          visible={backInStockOpen}
          onClose={() => setBackInStockOpen(false)}
          product={displayProduct}
          variant={selectedVariant}
          customerEmail={customerEmail ?? undefined}
          customerId={customerId}
          onSubscribed={markBackInStockSubscribed}
        />
      ) : null}

      <PdpSizeGuideModal visible={sizeGuideOpen} onClose={() => setSizeGuideOpen(false)} />

      <View className="absolute bottom-0 left-0 right-0 bg-transparent">
        <View className="px-5 pt-1" style={{ paddingBottom: ctaBottomPad }}>
          <Pressable
            disabled={addingToBag || (showBackInStockCta ? false : !canAdd)}
            onPress={showBackInStockCta ? onBackInStock : onAddToCart}
            accessibilityRole="button"
            accessibilityState={{ busy: addingToBag, disabled: addingToBag || (!showBackInStockCta && !canAdd) }}
            accessibilityLabel={showBackInStockCta ? backInStockCtaLabel : `Add to bag, ${addToBagPriceLabel}`}
            className="items-center justify-center rounded-full py-3.5 active:opacity-90"
            style={{
              backgroundColor: '#000000',
              opacity: addingToBag || showBackInStockCta || canAdd ? 1 : 0.42,
              shadowColor: '#000000',
              shadowOffset: { width: 0, height: 10 },
              shadowOpacity: 0.1,
              shadowRadius: 22,
              elevation: 6,
            }}>
            {addingToBag ? (
              <ActivityIndicator color={CTA_FG} />
            ) : (
              <Text className="font-sans-md text-[14px] tracking-[0.06em]" style={{ color: CTA_FG }}>
                {showBackInStockCta ? backInStockCtaLabel : `Add to bag · ${addToBagPriceLabel}`}
              </Text>
            )}
          </Pressable>
        </View>
      </View>
    </View>
  );
}

