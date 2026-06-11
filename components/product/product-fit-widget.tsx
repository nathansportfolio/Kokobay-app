import { View } from 'react-native';

import { Text } from '@/components/ui/text';
import {
  computeProductFitIndicatorPosition,
  shouldShowProductFitWidget,
  type ProductFitData,
} from '@/types/product-fit';

type ProductFitWidgetProps = {
  fitData?: ProductFitData;
};

export function ProductFitWidget({ fitData }: ProductFitWidgetProps) {
  if (!shouldShowProductFitWidget(fitData)) {
    return null;
  }

  const position = computeProductFitIndicatorPosition(fitData);

  return (
    <View className="mt-10">
      <Text variant="label" className="mb-2.5 text-[11px] uppercase tracking-[0.2em] text-muted">
        Size & fit
      </Text>

      <View className="relative h-1.5 rounded-full bg-[#e7e5e4]">
        <View className="absolute bottom-0 top-0 w-px bg-ink/25" style={{ left: '0%' }} />
        <View className="absolute bottom-0 top-0 w-px bg-ink/25" style={{ left: '50%' }} />
        <View className="absolute bottom-0 top-0 w-px bg-ink/25" style={{ left: '100%' }} />

        <View
          className="absolute h-3.5 w-3.5 rounded-full bg-ink"
          style={{
            left: `${position}%`,
            top: '50%',
            marginTop: -7,
            marginLeft: -7,
          }}
        />
      </View>

      <View className="mt-2 flex-row justify-between">
        <Text className="font-sans text-[12px] leading-4 text-ink/45">Runs small</Text>
        <Text className="font-sans text-[12px] leading-4 text-ink/45">True to size</Text>
        <Text className="font-sans text-[12px] leading-4 text-ink/45">Runs large</Text>
      </View>
    </View>
  );
}
