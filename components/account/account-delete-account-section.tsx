import { useCallback, useState } from 'react';
import { Pressable } from 'react-native';

import { AccountDeleteAccountModal } from '@/components/account/account-delete-account-modal';
import { Text } from '@/components/ui/text';
import { submitAccountDeletionRequest } from '@/services/kokobay-web/account-deletion';
import { showToast } from '@/store/toast';

type AccountDeleteAccountSectionProps = {
  sessionToken: string | null;
  onDeletionRequested: () => void | Promise<void>;
};

export function AccountDeleteAccountSection({
  sessionToken,
  onDeletionRequested,
}: AccountDeleteAccountSectionProps) {
  const [modalVisible, setModalVisible] = useState(false);
  const [busy, setBusy] = useState(false);

  const openModal = useCallback(() => {
    setModalVisible(true);
  }, []);

  const closeModal = useCallback(() => {
    if (!busy) setModalVisible(false);
  }, [busy]);

  const onConfirm = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    try {
      const result = await submitAccountDeletionRequest(sessionToken);
      if (!result.ok) {
        showToast({ variant: 'error', title: result.error });
        return;
      }

      setModalVisible(false);
      showToast({ variant: 'success', title: result.message });
      await onDeletionRequested();
    } finally {
      setBusy(false);
    }
  }, [busy, onDeletionRequested, sessionToken]);

  return (
    <>
      <Pressable
        onPress={openModal}
        disabled={busy}
        accessibilityRole="button"
        accessibilityLabel="Delete account and data"
        className="items-center py-4 active:opacity-70">
        <Text variant="caption" className="text-[13px] text-[#9A6B6B]">
          Delete account and data
        </Text>
      </Pressable>

      <AccountDeleteAccountModal
        visible={modalVisible}
        busy={busy}
        onClose={closeModal}
        onConfirm={onConfirm}
      />
    </>
  );
}
