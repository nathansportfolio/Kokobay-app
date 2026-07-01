import { BlurView } from 'expo-blur';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/button';
import { CatalogCoverImage } from '@/components/ui/catalog-cover-image';
import { Text } from '@/components/ui/text';
import { useBackInStockSubscription } from '@/hooks/use-back-in-stock-subscription';
import { useBackInStockPrefillEmail } from '@/hooks/use-back-in-stock-prefill-email';
import {
  subscribeBackInStock,
  variantTitleForBackInStock,
} from '@/services/kokobay-web/back-in-stock';
import { getAuthAccessToken } from '@/src/core/auth/token';
import type { Product, ProductVariant } from '@/types/shopify';
import { imageUrlForCartLine } from '@/utils/cart-display';
import { showBackInStockResultToast, deferBackInStockToast } from '@/utils/back-in-stock-toast';
import { hapticLight, hapticSuccess } from '@/utils/haptics';
import { formatMoney } from '@/utils/money';

const BLUR_OVERLAY = Platform.OS === 'ios';
const INPUT_CLASS =
  'border border-line bg-surface px-4 py-3.5 font-sans text-[15px] text-ink rounded-sm';

export type PdpBackInStockSheetProps = {
  visible: boolean;
  onClose: () => void;
  product: Product;
  variant: ProductVariant;
  customerEmail?: string;
  customerId?: string;
  onSubscribed?: () => void;
};

export function PdpBackInStockSheet({
  visible,
  onClose,
  product,
  variant,
  customerEmail,
  customerId,
  onSubscribed,
}: PdpBackInStockSheetProps) {
  const insets = useSafeAreaInsets();
  const sheetBottomPad = Math.max(insets.bottom, 28);
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [localSubscribed, setLocalSubscribed] = useState(false);

  const isLoggedIn = Boolean(customerEmail?.trim());
  const variantTitle = useMemo(() => variantTitleForBackInStock(variant), [variant]);
  const imageUrl = useMemo(() => imageUrlForCartLine(product, variant), [product, variant]);
  const priceLabel = formatMoney(variant.price);
  const prefillEmail = useBackInStockPrefillEmail({
    variantId: variant.id,
    customerEmail,
    enabled: visible,
  });

  const subscriptionEmail = isLoggedIn
    ? customerEmail?.trim()
    : email.trim() || prefillEmail.trim() || undefined;

  const { subscribed, checking, refresh, markSubscribed } = useBackInStockSubscription({
    variantId: variant.id,
    email: subscriptionEmail,
    customerId,
    enabled: visible && Boolean(subscriptionEmail),
  });

  useEffect(() => {
    if (!visible) return;
    setError(null);
    setLocalSubscribed(false);
    setEmail(prefillEmail);
  }, [visible, prefillEmail]);

  useEffect(() => {
    if (!visible) return;
    const checkEmail = isLoggedIn ? customerEmail?.trim() : prefillEmail.trim();
    if (checkEmail) void refresh();
  }, [visible, isLoggedIn, customerEmail, prefillEmail, refresh]);

  const close = useCallback(() => {
    hapticLight();
    onClose();
  }, [onClose]);

  const onSubmit = useCallback(async () => {
    const trimmedEmail = (isLoggedIn ? customerEmail?.trim() : email.trim()) ?? '';
    setError(null);
    setSubmitting(true);
    if (__DEV__) {
      console.log('[back-in-stock] submit', {
        handle: product.handle,
        variantId: variant.id,
        isLoggedIn,
        hasEmail: Boolean(trimmedEmail),
      });
    }
    try {
      const result = await subscribeBackInStock(
        {
          email: trimmedEmail,
          productHandle: product.handle,
          variantId: variant.id,
          productTitle: product.title,
          variantTitle,
        },
        { sessionToken: getAuthAccessToken(), customerId },
      );
      if (__DEV__) {
        console.log('[back-in-stock] result', { ok: result.ok, ...(result.ok ? {} : { error: result.error }) });
      }
      if (!result.ok) {
        setError(result.error);
        showBackInStockResultToast(result);
        return;
      }
      hapticSuccess();
      markSubscribed();
      setLocalSubscribed(true);
      onSubscribed?.();
      close();
      deferBackInStockToast(() => showBackInStockResultToast(result));
    } finally {
      setSubmitting(false);
    }
  }, [
    close,
    customerEmail,
    customerId,
    email,
    isLoggedIn,
    markSubscribed,
    onSubscribed,
    product.handle,
    product.title,
    variant.id,
    variantTitle,
  ]);

  const confirmedSubscribed = localSubscribed || subscribed;
  const showChecking = checking && !confirmedSubscribed && Boolean(subscriptionEmail);

  return (
    <Modal visible={visible} animationType="fade" transparent statusBarTranslucent onRequestClose={close}>
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

            <Text className="mb-6 font-sans-md text-[11px] uppercase tracking-[0.28em] text-ink">
              Back in stock
            </Text>

            <View className="mb-6 flex-row gap-4">
              {imageUrl ? (
                <View className="h-[88px] w-[72px] overflow-hidden rounded-md bg-warmElevated">
                  <CatalogCoverImage uri={imageUrl} recyclingKey={variant.id} />
                </View>
              ) : null}
              <View className="min-w-0 flex-1 justify-center">
                <Text
                  className="mb-1 font-sans-md text-[16px] leading-[22px] tracking-[-0.2px] text-ink"
                  numberOfLines={3}>
                  {product.title}
                </Text>
                <Text className="mb-1 font-sans text-[14px] leading-5 text-mist">{variantTitle}</Text>
                <Text className="font-sans text-[14px] tracking-wide text-accent">{priceLabel}</Text>
              </View>
            </View>

            {showChecking ? (
              <View className="min-h-[120px] items-center justify-center py-6">
                <ActivityIndicator color="#6E5E4F" />
              </View>
            ) : confirmedSubscribed ? (
                <View className="py-2">
                  <Text className="mb-3 font-sans-md text-[16px] leading-6 text-ink">
                    We will email you when back in stock
                  </Text>
                  <Text variant="body" className="mb-8 text-[15px] leading-6 text-muted">
                    {email.trim()
                      ? `We will notify ${email.trim()} as soon as this piece is available again.`
                      : 'We will notify you as soon as this piece is available again.'}
                  </Text>
                  <Button title="Close" variant="secondary" onPress={close} />
                </View>
            ) : (
              <View>
                <Text variant="body" className="mb-5 text-[15px] leading-6 text-muted">
                  {isLoggedIn
                    ? `We will email ${customerEmail?.trim() || 'you'} when this piece is available again.`
                    : 'Enter your email and we will let you know when this piece is available again.'}
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
                      value={email}
                      onChangeText={setEmail}
                      editable={!submitting}
                      placeholder="you@example.com"
                      placeholderTextColor="#71717A"
                      className={INPUT_CLASS}
                    />
                  </>
                ) : null}
                {error ? (
                  <Text variant="caption" className="mt-2 text-accentSoft">
                    {error}
                  </Text>
                ) : null}
                <View className="mt-8 gap-3">
                  <Button
                    title={submitting ? 'Saving…' : 'Notify me'}
                    variant="primary"
                    loading={submitting}
                    disabled={submitting || (!isLoggedIn && !email.trim())}
                    onPress={() => void onSubmit()}
                  />
                  <Button title="Cancel" variant="ghost" disabled={submitting} onPress={close} />
                </View>
              </View>
            )}
          </Animated.View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
