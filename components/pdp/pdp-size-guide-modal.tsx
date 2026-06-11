import { BlurView } from 'expo-blur';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { Text } from '@/components/ui/text';
import { palette } from '@/constants/theme';
import { useSizeGuideQuery } from '@/hooks/use-size-guide-query';
import type { SizeGuideMeasurement } from '@/types/size-guide';
import { cn } from '@/utils/cn';
import { hapticLight } from '@/utils/haptics';

const BLUR_OVERLAY = Platform.OS === 'ios';

type MeasurementUnit = 'inches' | 'cm';

export type PdpSizeGuideModalProps = {
  visible: boolean;
  onClose: () => void;
};

function formatMeasurement(value: { inches: number; cm: number }, unit: MeasurementUnit): string {
  if (unit === 'inches') {
    return `${value.inches}"`;
  }
  return Number.isInteger(value.cm) ? `${value.cm}` : `${value.cm}`;
}

function UnitToggle({
  unit,
  onChange,
}: {
  unit: MeasurementUnit;
  onChange: (unit: MeasurementUnit) => void;
}) {
  return (
    <View className="flex-row rounded-full border border-black/[0.08] bg-surface p-1">
      {(['inches', 'cm'] as const).map((option) => {
        const selected = unit === option;
        return (
          <Pressable
            key={option}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            accessibilityLabel={option === 'inches' ? 'Show inches' : 'Show centimetres'}
            onPress={() => {
              hapticLight();
              onChange(option);
            }}
            className={cn(
              'rounded-full px-4 py-2',
              selected ? 'bg-ink' : 'bg-transparent active:opacity-80',
            )}>
            <Text
              className={cn(
                'font-sans-md text-[12px] uppercase tracking-[0.14em]',
                selected ? 'text-canvas' : 'text-muted',
              )}>
              {option === 'inches' ? 'Inches' : 'CM'}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function MeasurementsTable({
  rows,
  unit,
}: {
  rows: SizeGuideMeasurement[];
  unit: MeasurementUnit;
}) {
  const unitLabel = unit === 'inches' ? 'In' : 'Cm';

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} nestedScrollEnabled>
      <View className="min-w-full">
        <View className="flex-row border-b border-black/[0.08] pb-3">
          <Text className="w-[52px] font-sans-md text-[11px] uppercase tracking-[0.16em] text-muted">
            UK
          </Text>
          <Text className="w-[72px] font-sans-md text-[11px] uppercase tracking-[0.16em] text-muted">
            Bust ({unitLabel})
          </Text>
          <Text className="w-[72px] font-sans-md text-[11px] uppercase tracking-[0.16em] text-muted">
            Waist ({unitLabel})
          </Text>
          <Text className="w-[72px] font-sans-md text-[11px] uppercase tracking-[0.16em] text-muted">
            Hips ({unitLabel})
          </Text>
        </View>
        {rows.map((row) => (
          <View key={row.ukSize} className="flex-row border-b border-black/[0.05] py-3.5">
            <Text className="w-[52px] font-sans-md text-[14px] text-ink">{row.ukSize}</Text>
            <Text className="w-[72px] font-sans text-[14px] text-ink">
              {formatMeasurement(row.bust, unit)}
            </Text>
            <Text className="w-[72px] font-sans text-[14px] text-ink">
              {formatMeasurement(row.waist, unit)}
            </Text>
            <Text className="w-[72px] font-sans text-[14px] text-ink">
              {formatMeasurement(row.hips, unit)}
            </Text>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

export function PdpSizeGuideModal({ visible, onClose }: PdpSizeGuideModalProps) {
  const insets = useSafeAreaInsets();
  const sheetBottomPad = Math.max(insets.bottom, 28);
  const [unit, setUnit] = useState<MeasurementUnit>('cm');
  const { data, isPending, isError } = useSizeGuideQuery(visible);

  const close = useCallback(() => {
    hapticLight();
    onClose();
  }, [onClose]);

  const title = data?.title?.trim() || 'Size guide';
  const letterSizes = useMemo(() => data?.letterSizes ?? [], [data?.letterSizes]);

  return (
    <Modal visible={visible} animationType="fade" transparent statusBarTranslucent onRequestClose={close}>
      <View className="flex-1 justify-end">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Dismiss size guide"
          onPress={close}
          style={{ flex: 1 }}
          className="w-full">
          <Animated.View entering={FadeIn.duration(260)} style={StyleSheet.absoluteFill}>
            {BLUR_OVERLAY ? <BlurView intensity={36} tint="dark" style={StyleSheet.absoluteFill} /> : null}
            <View
              style={[
                StyleSheet.absoluteFill,
                {
                  backgroundColor: BLUR_OVERLAY ? 'rgba(10, 8, 6, 0.32)' : 'rgba(0, 0, 0, 0.48)',
                },
              ]}
            />
          </Animated.View>
        </Pressable>

        <Animated.View
          entering={FadeInDown.duration(300).delay(12)}
          className="max-h-[88%] w-full overflow-hidden rounded-t-[28px] border-t border-line/30 bg-warmCanvas"
          style={{
            paddingBottom: sheetBottomPad,
            paddingHorizontal: 24,
            paddingTop: 24,
          }}>
          <View className="mb-5 h-1.5 w-12 self-center rounded-full bg-black/[0.1]" />

          <View className="mb-6 flex-row items-start justify-between gap-4">
            <Text className="flex-1 font-sans-md text-[11px] uppercase tracking-[0.28em] text-ink">
              {title}
            </Text>
            <Pressable
              onPress={close}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Close size guide"
              className="rounded-full p-1 active:opacity-70">
              <IconSymbol name="xmark" size={18} color={palette.ink} />
            </Pressable>
          </View>

          <UnitToggle unit={unit} onChange={setUnit} />

          <ScrollView
            showsVerticalScrollIndicator={false}
            nestedScrollEnabled
            contentContainerStyle={{ paddingTop: 24, paddingBottom: 8 }}>
            {isPending ? (
              <View className="items-center py-16">
                <ActivityIndicator color={palette.accent} />
              </View>
            ) : isError || !data ? (
              <Text className="py-10 text-center font-sans text-[15px] leading-7 text-muted">
                Size guide is unavailable right now. Please try again later.
              </Text>
            ) : (
              <>
                <MeasurementsTable rows={data.measurements} unit={unit} />

                {letterSizes.length > 0 ? (
                  <View className="mt-10 border-t border-black/[0.06] pt-8">
                    <Text className="mb-4 font-sans-md text-[11px] uppercase tracking-[0.2em] text-muted">
                      Letter sizes
                    </Text>
                    {letterSizes.map((entry) => (
                      <View
                        key={entry.size}
                        className="mb-3 flex-row items-center justify-between gap-4 last:mb-0">
                        <Text className="font-sans-md text-[14px] text-ink">{entry.size}</Text>
                        <Text className="font-sans text-[14px] text-muted">UK {entry.ukSizeRange}</Text>
                      </View>
                    ))}
                  </View>
                ) : null}
              </>
            )}
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
}
