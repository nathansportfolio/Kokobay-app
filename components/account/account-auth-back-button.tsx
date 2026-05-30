import { Pressable } from 'react-native';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { Text } from '@/components/ui/text';
import { LUXURY_SYMBOL } from '@/constants/luxury-icons';
import { luxuryChrome } from '@/constants/luxury-nav';
import { hapticLight } from '@/utils/haptics';

type AccountAuthBackButtonProps = {
  label: string;
  onPress: () => void;
};

export function AccountAuthBackButton({ label, onPress }: AccountAuthBackButtonProps) {
  return (
    <Pressable
      onPress={() => {
        hapticLight();
        onPress();
      }}
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
