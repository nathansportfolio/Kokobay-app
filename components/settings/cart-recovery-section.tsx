import { useCallback, useState } from 'react';
import { Alert, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { isCartRecoveryEnabled } from '@/lib/cart-recovery-access';
import { cartEngine } from '@/src/core/cart';
import { showToast } from '@/store/toast';

function confirmAsync(title: string, message: string): Promise<boolean> {
  return new Promise((resolve) => {
    Alert.alert(title, message, [
      { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
      { text: 'Continue', style: 'destructive', onPress: () => resolve(true) },
    ]);
  });
}

type Props = {
  customerEmail?: string | null;
};

export function CartRecoverySection({ customerEmail }: Props) {
  const [busy, setBusy] = useState<'clear' | 'server' | null>(null);

  const onClearLocal = useCallback(async () => {
    const confirmed = await confirmAsync(
      'Clear local cart storage?',
      'Removes cart data from SecureStore on this device. Does not modify server quantities or auto-adjust line counts.',
    );
    if (!confirmed) return;

    setBusy('clear');
    try {
      const result = await cartEngine.recoverClearLocal();
      showToast({
        variant: result.ok ? 'success' : 'error',
        title: result.ok ? 'Local cart cleared' : 'Recovery failed',
        description: result.message,
      });
    } finally {
      setBusy(null);
    }
  }, []);

  const onRefreshFromServer = useCallback(async () => {
    const confirmed = await confirmAsync(
      'Replace bag from server?',
      'Fetches the remote cart with GET only and replaces local lines with server quantities. No reconcile mutations and no local quantity adjustments.',
    );
    if (!confirmed) return;

    setBusy('server');
    try {
      const result = await cartEngine.recoverApplySnapshot(customerEmail ?? undefined);
      showToast({
        variant: result.ok ? 'success' : 'error',
        title: result.ok ? 'Server cart applied' : 'Recovery failed',
        description: result.message,
      });
    } finally {
      setBusy(null);
    }
  }, [customerEmail]);

  if (!isCartRecoveryEnabled()) {
    return null;
  }

  return (
    <View className="mb-8 border border-line bg-surface px-4 py-5">
      <Text variant="label" className="mb-2 text-mist">
        Cart recovery (dev/admin)
      </Text>
      <Text variant="caption" className="mb-4 text-mist">
        Fix corrupted local cart storage after bad hydrates. Never auto-adjusts quantities.
      </Text>
      <View className="gap-3">
        <Button
          title={busy === 'clear' ? 'Clearing…' : 'Clear local cart storage'}
          variant="secondary"
          loading={busy === 'clear'}
          disabled={busy !== null}
          onPress={() => void onClearLocal()}
        />
        <Button
          title={busy === 'server' ? 'Fetching…' : 'Replace bag from server (read-only)'}
          variant="secondary"
          loading={busy === 'server'}
          disabled={busy !== null}
          onPress={() => void onRefreshFromServer()}
        />
      </View>
    </View>
  );
}
