import type { Href } from 'expo-router';
import { useRouter } from 'expo-router';
import { Pressable } from 'react-native';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { Text } from '@/components/ui/text';
import { LUXURY_SYMBOL } from '@/constants/luxury-icons';
import { luxuryChrome } from '@/constants/luxury-nav';
import { hapticLight } from '@/utils/haptics';

type AuthFormBackButtonProps = {
  fallbackHref?: Href;
  fallbackLabel?: string;
  checkoutReturnTo?: string | null;
};

export function AuthFormBackButton({
  fallbackHref = '/(tabs)/account',
  fallbackLabel = 'Account',
  checkoutReturnTo = null,
}: AuthFormBackButtonProps) {
  const router = useRouter();

  const onBack = () => {
    hapticLight();
    if (router.canGoBack()) {
      router.back();
      return;
    }
    if (checkoutReturnTo) {
      router.replace({ pathname: '/checkout', params: { url: checkoutReturnTo } });
      return;
    }
    router.replace(fallbackHref);
  };

  const label =
    checkoutReturnTo ? 'Back to checkout'
    : router.canGoBack() ? 'Back'
    : fallbackLabel;

  return (
    <Pressable
      onPress={onBack}
      accessibilityRole="button"
      accessibilityLabel={label}
      className="mb-6 flex-row items-center gap-1 self-start py-1">
      <IconSymbol
        name="chevron.left"
        size={LUXURY_SYMBOL.chromeIconSize}
        color={luxuryChrome.ink}
        weight={LUXURY_SYMBOL.chromeWeight}
      />
      <Text className="font-sans-medium text-[13px] tracking-[-0.2px] text-ink">{label}</Text>
    </Pressable>
  );
}
