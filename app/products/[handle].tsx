import { Redirect, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { classifyProductDeepLinkIdentifier } from '@/lib/deep-link-router';
import { fetchProductHandleByVariantId } from '@/services/kokobay-web/product-by-variant';

/** Push / universal link entry — resolves variant ids, then forwards to the tabbed product screen. */
export default function ProductDeepLinkScreen() {
  const { handle } = useLocalSearchParams<{ handle: string }>();
  const safe = typeof handle === 'string' ? decodeURIComponent(handle) : '';
  const classified = safe ? classifyProductDeepLinkIdentifier(safe) : null;
  const handleSlug = classified?.kind === 'handle' ? classified.handle : null;
  const variantId = classified?.kind === 'variant' ? classified.variantId : null;
  const [resolvedHandle, setResolvedHandle] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setResolvedHandle(null);
    setFailed(false);

    if (handleSlug) {
      setResolvedHandle(handleSlug);
      return;
    }

    if (!variantId) return;

    let cancelled = false;
    void fetchProductHandleByVariantId(variantId).then((productHandle) => {
      if (cancelled) return;
      if (productHandle) {
        setResolvedHandle(productHandle);
      } else {
        setFailed(true);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [safe, handleSlug, variantId]);

  if (!safe || failed) {
    return <Redirect href="/(tabs)" />;
  }

  if (!resolvedHandle) {
    return (
      <View className="flex-1 items-center justify-center bg-canvas">
        <ActivityIndicator />
      </View>
    );
  }

  return <Redirect href={`/product/${encodeURIComponent(resolvedHandle)}`} />;
}
