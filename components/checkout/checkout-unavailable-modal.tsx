import { router } from 'expo-router';
import { Modal, Pressable, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { formTokens } from '@/constants/form-tokens';
import {
  hideCheckoutUnavailableModal,
  useCheckoutUnavailableModalStore,
} from '@/store/checkout-unavailable-modal';

export function CheckoutUnavailableModal() {
  const visible = useCheckoutUnavailableModalStore((s) => s.visible);
  const title = useCheckoutUnavailableModalStore((s) => s.title);
  const message = useCheckoutUnavailableModalStore((s) => s.message);
  const onTryAgain = useCheckoutUnavailableModalStore((s) => s.onTryAgain);

  const onContinueShopping = () => {
    hideCheckoutUnavailableModal();
    router.replace('/(tabs)');
  };

  const onRetry = () => {
    const retry = onTryAgain;
    hideCheckoutUnavailableModal();
    retry?.();
  };

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      statusBarTranslucent
      onRequestClose={onContinueShopping}>
      <View className="flex-1 items-center justify-center bg-black/45 px-6">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Dismiss"
          onPress={onContinueShopping}
          className="absolute inset-0"
        />
        <View
          className="w-full max-w-[400px] border border-line bg-canvas px-6 py-7"
          style={{ borderRadius: formTokens.input.borderRadius }}>
          <Text variant="title" className="mb-3 text-center text-ink">
            {title}
          </Text>
          <Text variant="body" className="mb-7 text-center text-mist">
            {message}
          </Text>
          <View className="gap-3">
            <Button title="Try Again" variant="primary" onPress={onRetry} />
            <Button title="Continue Shopping" variant="secondary" onPress={onContinueShopping} />
          </View>
        </View>
      </View>
    </Modal>
  );
}
