import { Modal, Pressable, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { formTokens } from '@/constants/form-tokens';

type AccountDeleteAccountModalProps = {
  visible: boolean;
  busy: boolean;
  onClose: () => void;
  onConfirm: () => void;
};

export function AccountDeleteAccountModal({
  visible,
  busy,
  onClose,
  onConfirm,
}: AccountDeleteAccountModalProps) {
  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={busy ? undefined : onClose}>
      <View className="flex-1 items-center justify-center bg-black/45 px-6">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Dismiss"
          disabled={busy}
          onPress={onClose}
          className="absolute inset-0"
        />
        <View
          className="w-full max-w-[400px] border border-line bg-canvas px-6 py-7"
          style={{ borderRadius: formTokens.input.borderRadius }}>
          <Text variant="title" className="mb-3 text-center text-ink">
            Delete account and data?
          </Text>
          <Text variant="body" className="mb-2 text-center text-mist">
            This permanently deletes your Koko Bay account, associated app data, and your store
            customer profile. This cannot be undone.
          </Text>
          <Text variant="caption" className="mb-7 text-center text-mist">
            You will be signed out on this device immediately.
          </Text>
          <View className="gap-3">
            <Button
              title={busy ? 'Deleting…' : 'Yes, delete my account'}
              variant="primary"
              loading={busy}
              disabled={busy}
              onPress={onConfirm}
            />
            <Button title="Cancel" variant="secondary" disabled={busy} onPress={onClose} />
          </View>
        </View>
      </View>
    </Modal>
  );
}
