import { Pressable, View } from 'react-native';

import { Text } from '@/components/ui/text';
import { cn } from '@/utils/cn';
import { hapticLight } from '@/utils/haptics';

const MAX_QTY = 10;

export type PdpQtyStepperProps = {
  value: number;
  onChange: (qty: number) => void;
  disabled?: boolean;
};

export function PdpQtyStepper({ value, onChange, disabled }: PdpQtyStepperProps) {
  return (
    <View className="mb-10">
      <Text variant="label" className="mb-2.5 text-[11px] uppercase tracking-[0.2em] text-muted">
        Quantity
      </Text>
      <View className="flex-row items-center self-start rounded-full border border-line/45 bg-warmSurface/90 px-0.5 py-0.5">
        <Pressable
          disabled={disabled || value <= 1}
          onPress={() => {
            hapticLight();
            onChange(Math.max(1, value - 1));
          }}
          hitSlop={6}
          className={cn(
            'min-h-[40px] min-w-[40px] items-center justify-center rounded-full active:bg-warmElevated',
            (disabled || value <= 1) && 'opacity-35',
          )}>
          <Text variant="title" className="text-[17px] font-normal leading-none text-ink">
            −
          </Text>
        </Pressable>
        <View className="min-w-[32px] items-center px-0.5">
          <Text className="font-sans-md text-[15px] leading-none text-ink">
            {value}
          </Text>
        </View>
        <Pressable
          disabled={disabled || value >= MAX_QTY}
          onPress={() => {
            hapticLight();
            onChange(Math.min(MAX_QTY, value + 1));
          }}
          hitSlop={6}
          className={cn(
            'min-h-[40px] min-w-[40px] items-center justify-center rounded-full active:bg-warmElevated',
            (disabled || value >= MAX_QTY) && 'opacity-35',
          )}>
          <Text variant="title" className="text-[17px] font-normal leading-none text-ink">
            +
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
