import { Pressable, View } from 'react-native';

import { Text } from '@/components/ui/text';
import { cn } from '@/utils/cn';
import { hapticSelection } from '@/utils/haptics';

export type PdpSizeSelectorProps = {
  sizes: string[];
  value: string;
  onChange: (size: string) => void;
  disabled?: boolean;
  /** When false, size chip is disabled and shown as sold out. Omitted / missing key = available */
  sizeAvailable?: Record<string, boolean>;
  /** Opens the size guide modal from the size row. */
  onOpenSizeGuide?: () => void;
  /** Omit bottom margin when embedded (e.g. quick-add sheet) — chips match PDP exactly */
  embedBottom?: boolean;
};

export function PdpSizeSelector({
  sizes,
  value,
  onChange,
  disabled,
  sizeAvailable,
  onOpenSizeGuide,
  embedBottom = false,
}: PdpSizeSelectorProps) {
  if (sizes.length === 0) {
    return null;
  }

  return (
    <View className={embedBottom ? 'mb-0' : 'mb-10'}>
      <View className="mb-4 flex-row items-center justify-between gap-3">
        <Text variant="label" className="text-[11px] uppercase tracking-[0.2em] text-muted">
          Size
        </Text>
        {onOpenSizeGuide ? (
          <Pressable
            onPress={() => {
              hapticSelection();
              onOpenSizeGuide();
            }}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Open size guide">
            <Text className="font-sans text-[13px] tracking-[0.04em] text-accent underline">
              Size guide
            </Text>
          </Pressable>
        ) : null}
      </View>
      <View className="flex-row flex-wrap gap-3">
        {sizes.map((s) => {
          const selected = s === value;
          const available = sizeAvailable?.[s] !== false;
          const chipDisabled = Boolean(disabled);

          return (
            <Pressable
              key={s}
              disabled={chipDisabled}
              accessibilityState={{
                disabled: chipDisabled,
                selected,
              }}
              accessibilityLabel={available ? `Size ${s}` : `Size ${s}, no stock`}
              onPress={() => {
                hapticSelection();
                onChange(s);
              }}
              className={cn(
                'min-w-[52px] items-center justify-center rounded-full border px-4 py-3',
                selected && available && 'border-ink bg-ink',
                selected && !available && 'border-ink bg-line',
                !selected && available && 'border-black/[0.08] bg-surface active:bg-elevated/35',
                !selected && !available && 'border-black/[0.11] bg-elevated',
                disabled && 'opacity-40',
              )}
              style={!available && !selected ? { opacity: 0.86 } : undefined}>
              <Text
                variant="caption"
                className={cn(
                  'text-center text-[14px] tracking-wide',
                  selected && available && 'font-sans-md text-canvas',
                  selected && !available && 'font-sans-md text-ink line-through',
                  !selected && available && 'text-ink',
                  !selected && !available && 'text-muted line-through',
                )}>
                {s}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
