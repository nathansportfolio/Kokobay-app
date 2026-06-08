import { X } from 'lucide-react-native';
import { useEffect, useRef } from 'react';
import { Modal, Pressable, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { formTokens } from '@/constants/form-tokens';
import {
  trackAppUpdateClicked,
  trackAppUpdateDismissed,
  trackAppUpdateOptionalShown,
} from '@/lib/gtm/events';
import { openAppStoreListing } from '@/src/core/app-version/open-app-store';
import { recordOptionalUpdateDismissed } from '@/src/core/app-version/app-version-persist';

type UpdateAvailableDrawerProps = {
  visible: boolean;
  title: string;
  message: string;
  currentVersion: string;
  latestVersion?: string;
  onDismiss: () => void;
};

export function UpdateAvailableDrawer({
  visible,
  title,
  message,
  currentVersion,
  latestVersion,
  onDismiss,
}: UpdateAvailableDrawerProps) {
  const trackedRef = useRef(false);

  useEffect(() => {
    if (!visible || trackedRef.current) return;
    trackedRef.current = true;
    trackAppUpdateOptionalShown({
      currentVersion,
      latestVersion,
    });
  }, [visible, currentVersion, latestVersion]);

  const dismiss = (source: 'later' | 'close') => {
    trackAppUpdateDismissed({
      source,
      currentVersion,
      latestVersion,
    });
    void recordOptionalUpdateDismissed();
    onDismiss();
  };

  const onUpdate = () => {
    trackAppUpdateClicked({
      prompt: 'optional',
      currentVersion,
      latestVersion,
    });
    void openAppStoreListing();
  };

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      statusBarTranslucent
      presentationStyle="overFullScreen"
      onRequestClose={() => dismiss('close')}>
      <View className="flex-1 items-center justify-center bg-black/45 px-6">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Dismiss update prompt"
          onPress={() => dismiss('close')}
          className="absolute inset-0"
        />
        <View
          className="w-full max-w-[400px] border border-line bg-canvas px-6 py-7"
          style={{ borderRadius: formTokens.input.borderRadius }}>
          <View className="mb-3 flex-row items-start justify-between gap-3">
            <Text variant="title" className="flex-1 text-ink">
              {title}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close"
              hitSlop={8}
              onPress={() => dismiss('close')}
              className="mt-0.5">
              <X size={20} color="#1A1A1A" strokeWidth={2} />
            </Pressable>
          </View>
          <Text variant="body" className="mb-7 text-mist">
            {message}
          </Text>
          <View className="gap-3">
            <Button title="Update Now" variant="primary" onPress={onUpdate} />
            <Button title="Later" variant="secondary" onPress={() => dismiss('later')} />
          </View>
        </View>
      </View>
    </Modal>
  );
}
