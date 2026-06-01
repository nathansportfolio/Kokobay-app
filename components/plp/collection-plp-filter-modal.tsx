import type { ReactNode } from 'react';
import { useCallback, useMemo } from 'react';
import { Modal, Platform, Pressable, ScrollView, TouchableOpacity, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { PdpAccordion } from '@/components/pdp/pdp-accordion';
import { PlpPriceRangeRail } from '@/components/plp/plp-price-range-rail';
import { Button } from '@/components/ui/button';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Text } from '@/components/ui/text';
import { palette } from '@/constants/theme';
import type { PlpFilters } from '@/types/plp';
import { cn } from '@/utils/cn';
import { hapticLight, hapticMedium } from '@/utils/haptics';
import { formatMoney } from '@/utils/money';
import { swatchHexForColourGroup } from '@/utils/colour-groups';
import { PLP_PRICE_SLIDER_EPS, listActivePlpFilterChips, plpPriceSliderStep, removePlpFilterChip } from '@/utils/plp';
import type { PlpFacetCounts } from '@/utils/storefront-filters';
import { visibleFacetOptions } from '@/utils/storefront-filters';

export type CollectionPlpFilterModalProps = {
  visible: boolean;
  onClose: () => void;
  draft: PlpFilters;
  onChangeDraft: (next: PlpFilters) => void;
  /** Count of products matching the current filter state (updates as the user toggles). */
  filteredProductCount: number;
  onClear: () => void;
  facetSizes: string[];
  facetCategories: string[];
  facetColourGroups: string[];
  facetSizeCounts?: PlpFacetCounts;
  facetCategoryCounts?: PlpFacetCounts;
  facetColourGroupCounts?: PlpFacetCounts;
  /** Lowest / highest product min price in the current catalogue slice (slider bounds). */
  priceSliderMin: number;
  priceSliderMax: number;
  priceCurrencyCode: string;
};

function filterAccordionTitle(label: string, selectedCount: number): string {
  return selectedCount > 0 ? `${label} · ${selectedCount}` : label;
}

function activeFilterChipKey(chip: ReturnType<typeof listActivePlpFilterChips>[number]): string {
  return `${chip.kind}:${chip.value}`;
}

function ActiveFilterBadge({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <View className="min-h-[34px] flex-row items-center rounded-full border border-line/60 bg-warmElevated/80 px-3.5 py-2">
      <Text
        variant="caption"
        numberOfLines={1}
        className="shrink leading-5 text-ink"
        style={Platform.OS === 'android' ? { includeFontPadding: false } : undefined}>
        {label}
      </Text>
      <Pressable
        onPress={onRemove}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={`Remove ${label} filter`}
        className="ml-2 rounded-full p-0.5 active:opacity-70">
        <IconSymbol name="xmark" size={12} color={palette.mist} />
      </Pressable>
    </View>
  );
}

function ActiveFilterBadges({
  draft,
  onChangeDraft,
}: {
  draft: PlpFilters;
  onChangeDraft: (next: PlpFilters) => void;
}) {
  const chips = useMemo(() => listActivePlpFilterChips(draft), [draft]);

  if (!chips.length) {
    return null;
  }

  return (
    <View className="-mx-5 border-b border-line/40 px-5 pb-4 pt-4">
      <Text className="mb-3 font-sans-md text-[11px] uppercase tracking-[0.28em] text-ink">
        Active filters
      </Text>
      <View className="flex-row flex-wrap gap-2">
        {chips.map((chip) => (
          <ActiveFilterBadge
            key={activeFilterChipKey(chip)}
            label={chip.label}
            onRemove={() => {
              hapticLight();
              onChangeDraft(removePlpFilterChip(draft, chip));
            }}
          />
        ))}
      </View>
    </View>
  );
}

function FilterColourSwatch({ hex }: { hex: string }) {
  return (
    <View
      className="mr-3 h-[18px] w-[18px] rounded-full border border-line/45"
      style={{ backgroundColor: hex }}
      accessibilityElementsHidden
    />
  );
}

function FilterOptionRow({
  label,
  count,
  selected,
  onPress,
  showDivider,
  swatchHex,
}: {
  label: string;
  count?: number;
  selected: boolean;
  onPress: () => void;
  showDivider?: boolean;
  swatchHex?: string;
}) {
  return (
    <Pressable
      onPress={() => {
        hapticLight();
        onPress();
      }}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={count != null ? `${label}, ${count} products` : label}
      className={cn(
        'flex-row items-center justify-between py-3.5 active:opacity-78',
        showDivider && 'border-b border-line/35',
        selected && 'bg-warmElevated/55',
      )}>
      <View className="min-w-0 flex-1 flex-row items-center pr-3">
        {swatchHex ? <FilterColourSwatch hex={swatchHex} /> : null}
        <Text
          className={cn(
            'shrink font-sans text-[15px] leading-5 tracking-[0.01em]',
            selected ? 'font-sans-md text-ink' : 'text-mist/90',
          )}>
          {label}
        </Text>
      </View>
      <View className="flex-row items-center gap-2">
        {count != null ? (
          <Text variant="caption" className="font-sans text-[13px] tabular-nums text-muted">
            ({count})
          </Text>
        ) : null}
        {selected ? (
          <View className="h-1.5 w-1.5 rounded-full bg-accent" accessibilityElementsHidden />
        ) : (
          <View className="h-1.5 w-1.5" accessibilityElementsHidden />
        )}
      </View>
    </Pressable>
  );
}

function FilterOptionList({
  options,
  selected,
  onToggle,
  swatchForOption,
  countForOption,
}: {
  options: string[];
  selected: string[];
  onToggle: (value: string) => void;
  swatchForOption?: (option: string) => string | undefined;
  countForOption?: (option: string) => number | undefined;
}) {
  if (!options.length) {
    return (
      <Text variant="caption" className="font-sans text-[13px] leading-5 text-muted">
        No options for this collection.
      </Text>
    );
  }

  return (
    <View>
      {options.map((option, index) => (
        <FilterOptionRow
          key={option}
          label={option}
          count={countForOption?.(option)}
          selected={selected.includes(option)}
          showDivider={index < options.length - 1}
          swatchHex={swatchForOption?.(option)}
          onPress={() => onToggle(option)}
        />
      ))}
    </View>
  );
}

function PriceSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View className="border-b border-line/40 pb-6 pt-4">
      <Text className="mb-4 font-sans-md text-[11px] uppercase tracking-[0.28em] text-ink">{title}</Text>
      {children}
    </View>
  );
}

function toggleInList(list: string[], value: string): string[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

function FilterModalHeaderAction({
  action,
  label,
  onPress,
  align = 'start',
  accent,
}: {
  action: 'Close' | 'Clear';
  label: string;
  onPress: () => void;
  align?: 'start' | 'end';
  accent?: boolean;
}) {
  const touchHandlers = {
    onPress: () => onPress(),
  };

  const labelClass = accent
    ? 'font-sans-md text-[15px] leading-5 text-accent'
    : 'font-sans text-[15px] leading-5 text-mist';

  const rowClass = cn(
    'z-10 min-h-[44px] min-w-[72px] shrink-0 justify-center py-2',
    align === 'end' && 'items-end',
  );

  if (Platform.OS === 'android') {
    return (
      <TouchableOpacity
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel={action === 'Close' ? 'Close filters' : 'Clear all filters'}
        className={rowClass}
        style={{ paddingHorizontal: 10 }}
        {...touchHandlers}>
        <Text className={labelClass}>{label}</Text>
      </TouchableOpacity>
    );
  }

  return (
    <Pressable
      hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
      accessibilityRole="button"
      accessibilityLabel={action === 'Close' ? 'Close filters' : 'Clear all filters'}
      className={rowClass}
      {...touchHandlers}>
      <Text className={labelClass}>{label}</Text>
    </Pressable>
  );
}

export function CollectionPlpFilterModal({
  visible,
  onClose,
  draft,
  onChangeDraft,
  filteredProductCount,
  onClear,
  facetSizes,
  facetCategories,
  facetColourGroups,
  facetSizeCounts,
  facetCategoryCounts,
  facetColourGroupCounts,
  priceSliderMin,
  priceSliderMax,
  priceCurrencyCode,
}: CollectionPlpFilterModalProps) {
  const insets = useSafeAreaInsets();
  const range = Math.max(priceSliderMax - priceSliderMin, 0);
  const step = useMemo(
    () => plpPriceSliderStep(Math.max(priceSliderMax, range || 1)),
    [priceSliderMax, range],
  );

  const uniformPriceLabel = formatMoney({
    amount: Math.round(priceSliderMin).toFixed(2),
    currencyCode: priceCurrencyCode,
  });

  const visibleFacetSizes = useMemo(
    () => visibleFacetOptions(facetSizes, facetSizeCounts, draft.sizes),
    [facetSizes, facetSizeCounts, draft.sizes],
  );
  const visibleFacetCategories = useMemo(
    () => visibleFacetOptions(facetCategories, facetCategoryCounts, draft.categories),
    [facetCategories, facetCategoryCounts, draft.categories],
  );
  const visibleFacetColourGroups = useMemo(
    () => visibleFacetOptions(facetColourGroups, facetColourGroupCounts, draft.colors),
    [facetColourGroups, facetColourGroupCounts, draft.colors],
  );

  const handleClose = useCallback(() => {
    hapticLight();
    onClose();
  }, [onClose]);

  const handleClear = useCallback(() => {
    onClear();
  }, [onClear]);

  const titleBlock = (
    <View className="min-w-0 flex-1 px-2" pointerEvents="none">
      <Text
        variant="title"
        numberOfLines={1}
        className="text-center text-[17px] tracking-[-0.2px] text-ink">
        Filters
      </Text>
    </View>
  );

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={handleClose}>
      <SafeAreaView className="flex-1 bg-canvas" edges={['top', 'left', 'right']}>
        <View className="flex-row items-center border-b border-line/60 px-4 py-3">
          {Platform.OS === 'android' ?
            <>
              {titleBlock}
              <FilterModalHeaderAction action="Close" label="Close" onPress={handleClose} align="end" />
              <FilterModalHeaderAction action="Clear" label="Clear" onPress={handleClear} align="end" accent />
            </>
          : <>
              <FilterModalHeaderAction action="Close" label="Close" onPress={handleClose} />
              {titleBlock}
              <FilterModalHeaderAction action="Clear" label="Clear" onPress={handleClear} align="end" accent />
            </>
          }
        </View>
        <ScrollView
          className="flex-1 px-5 pt-2"
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingBottom: 24 }}>
          <ActiveFilterBadges draft={draft} onChangeDraft={onChangeDraft} />
          {visibleFacetSizes.length > 0 ? (
            <PdpAccordion
              title={filterAccordionTitle('Size', draft.sizes.length)}
              defaultOpen={draft.sizes.length > 0}>
              <FilterOptionList
                options={visibleFacetSizes}
                selected={draft.sizes}
                countForOption={(option) => facetSizeCounts?.[option]}
                onToggle={(value) =>
                  onChangeDraft({ ...draft, sizes: toggleInList(draft.sizes, value) })
                }
              />
            </PdpAccordion>
          ) : null}

          {visibleFacetCategories.length > 0 ? (
            <PdpAccordion
              title={filterAccordionTitle('Category', draft.categories.length)}
              defaultOpen={draft.categories.length > 0}>
              <FilterOptionList
                options={visibleFacetCategories}
                selected={draft.categories}
                countForOption={(option) => facetCategoryCounts?.[option]}
                onToggle={(value) =>
                  onChangeDraft({ ...draft, categories: toggleInList(draft.categories, value) })
                }
              />
            </PdpAccordion>
          ) : null}

          {visibleFacetColourGroups.length > 0 ? (
            <PdpAccordion
              title={filterAccordionTitle('Colour', draft.colors.length)}
              defaultOpen={draft.colors.length > 0}>
              <FilterOptionList
                options={visibleFacetColourGroups}
                selected={draft.colors}
                swatchForOption={swatchHexForColourGroup}
                countForOption={(option) => facetColourGroupCounts?.[option]}
                onToggle={(value) =>
                  onChangeDraft({ ...draft, colors: toggleInList(draft.colors, value) })
                }
              />
            </PdpAccordion>
          ) : null}

          <PriceSection title="Price">
            {priceSliderMax <= 0 ? (
              <Text variant="caption" className="font-sans text-[13px] leading-5 text-muted">
                No priced products in this list.
              </Text>
            ) : priceSliderMax <= priceSliderMin + PLP_PRICE_SLIDER_EPS ? (
              <Text variant="caption" className="font-sans text-[13px] leading-5 text-muted">
                All pieces in this list are priced {uniformPriceLabel}.
              </Text>
            ) : (
              <PlpPriceRangeRail
                catalogMin={priceSliderMin}
                catalogMax={priceSliderMax}
                step={step}
                currencyCode={priceCurrencyCode}
                draft={draft}
                onChangeDraft={onChangeDraft}
              />
            )}
          </PriceSection>
        </ScrollView>
        <View className="border-t border-line/60 px-5 pt-4" style={{ marginBottom: Math.max(insets.bottom, 16) }}>
          <Button
            title={`View ${filteredProductCount} Product${filteredProductCount === 1 ? '' : 's'}`}
            variant="primary"
            onPress={() => {
              hapticMedium();
              onClose();
            }}
          />
        </View>
      </SafeAreaView>
    </Modal>
  );
}
