import { Platform, Pressable, View, type TextStyle, type ViewStyle } from 'react-native';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { Text } from '@/components/ui/text';
import { LUXURY_SYMBOL } from '@/constants/luxury-icons';
import { palette } from '@/constants/theme';
import { cn } from '@/utils/cn';

const FILTER_BADGE_HEIGHT = 18;

const filterBadgeContainerStyle: ViewStyle = {
  backgroundColor: palette.ink,
  minWidth: FILTER_BADGE_HEIGHT,
  height: FILTER_BADGE_HEIGHT,
  borderRadius: FILTER_BADGE_HEIGHT / 2,
  paddingHorizontal: 4,
  alignItems: 'center',
  justifyContent: 'center',
  marginTop: 1,
};

const filterBadgeTextStyle: TextStyle = {
  color: palette.surface,
  fontFamily: 'InstrumentSans-Medium',
  fontSize: 11,
  lineHeight: Platform.OS === 'ios' ? FILTER_BADGE_HEIGHT : FILTER_BADGE_HEIGHT - 1,
  textAlign: 'center',
  ...(Platform.OS === 'android' ? { includeFontPadding: false } : {}),
};

export type CollectionPlpToolbarProps = {
  onFilterPress: () => void;
  onSortPress: () => void;
  onGridToggle: () => void;
  numColumns: 1 | 2;
  activeFilterCount: number;
  className?: string;
};

export function CollectionPlpToolbar({
  onFilterPress,
  onSortPress,
  onGridToggle,
  numColumns,
  activeFilterCount,
  className,
}: CollectionPlpToolbarProps) {
  const gridIcon = numColumns === 2 ? 'rectangle.split.1x2' : 'square.grid.2x2';

  return (
    <View
      className={cn(
        'flex-row items-center justify-between border-b border-line bg-surface px-2 py-3',
        className,
      )}>
      <Pressable
        onPress={onFilterPress}
        accessibilityRole="button"
        accessibilityLabel="Filters"
        className="flex-row items-center gap-2 rounded-sm px-3 py-2 active:bg-elevated">
        <IconSymbol
          name="slider.horizontal.3"
          size={22}
          color={palette.mist}
          weight={LUXURY_SYMBOL.chromeWeight}
        />
        <View className="flex-row items-center gap-1.5">
          <Text variant="caption" className="text-ink">
            Filter
          </Text>
          {activeFilterCount > 0 ? (
            <View style={filterBadgeContainerStyle}>
              <Text style={filterBadgeTextStyle}>{activeFilterCount}</Text>
            </View>
          ) : null}
        </View>
      </Pressable>
      <Pressable
        onPress={onSortPress}
        accessibilityRole="button"
        accessibilityLabel="Sort"
        className="flex-row items-center gap-2 rounded-sm px-3 py-2 active:bg-elevated">
        <IconSymbol
          name="arrow.up.arrow.down"
          size={22}
          color={palette.mist}
          weight={LUXURY_SYMBOL.chromeWeight}
        />
        <Text variant="caption" className="text-ink">
          Sort
        </Text>
      </Pressable>
      <Pressable
        onPress={onGridToggle}
        accessibilityRole="button"
        accessibilityLabel={numColumns === 2 ? 'Single column grid' : 'Two column grid'}
        className="rounded-sm p-2 active:bg-elevated">
        <IconSymbol name={gridIcon} size={22} color={palette.mist} weight={LUXURY_SYMBOL.chromeWeight} />
      </Pressable>
    </View>
  );
}
