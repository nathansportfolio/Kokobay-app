import { Modal, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { formTokens } from '@/constants/form-tokens';
import { openAppStoreListing } from '@/src/core/app-version/open-app-store';
import { trackAppUpdateClicked, trackAppUpdateRequiredShown } from '@/lib/gtm/events';
import { useEffect, useRef } from 'react';

type UpdateRequiredDrawerProps = {
  visible: boolean;
  title: string;
  message: string;
  currentVersion: string;
  latestVersion?: string;
};

export function UpdateRequiredDrawer({
  visible,
  title,
  message,
  currentVersion,
  latestVersion,
}: UpdateRequiredDrawerProps) {
  const trackedRef = useRef(false);

  useEffect(() => {
    if (!visible || trackedRef.current) return;
    trackedRef.current = true;
    trackAppUpdateRequiredShown({
      currentVersion,
      latestVersion,
    });
  }, [visible, currentVersion, latestVersion]);

  const onUpdate = () => {
    trackAppUpdateClicked({
      prompt: 'required',
      currentVersion,
      latestVersion,
    });
    void openAppStoreListing();
  };

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent={false}
      statusBarTranslucent
      presentationStyle="overFullScreen"
      onRequestClose={() => {}}>
      <View className="flex-1 items-center justify-center bg-canvas px-6">
        <View
          className="w-full max-w-[400px] border border-line bg-canvas px-6 py-7"
          style={{ borderRadius: formTokens.input.borderRadius }}>
          <Text variant="title" className="mb-3 text-center text-ink">
            {title}
          </Text>
          <Text variant="body" className="mb-7 text-center text-mist">
            {message}
          </Text>
          <Button title="Update App" variant="primary" onPress={onUpdate} />
        </View>
      </View>
    </Modal>
  );
}
