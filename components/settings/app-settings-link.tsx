import { Pressable } from 'react-native';

import { Text } from '@/components/ui/text';

type AppSettingsLinkProps = {
  className?: string;
  onPress: () => void;
};

export function AppSettingsLink({ className, onPress }: AppSettingsLinkProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="App settings"
      className={`items-center py-4 active:opacity-70 ${className ?? 'mt-10'}`}>
      <Text variant="caption" className="text-mist underline">
        App settings
      </Text>
    </Pressable>
  );
}
