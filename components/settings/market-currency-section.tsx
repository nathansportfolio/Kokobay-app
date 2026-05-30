import { useMemo } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';

import { Text } from '@/components/ui/text';
import { useMarketOptions } from '@/hooks/use-market-options';
import { useMarketStore } from '@/store/market-preference';
import { showToast } from '@/store/toast';
import { cn } from '@/utils/cn';
import { hapticLight } from '@/utils/haptics';

function MarketOptionRow({
  label,
  selected,
  onPress,
  showDivider,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  showDivider?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      className={cn(
        'flex-row items-center justify-between py-3.5 active:opacity-78',
        showDivider && 'border-b border-line/35',
        selected && 'bg-warmElevated/55',
      )}>
      <View className="min-w-0 flex-1 pr-3">
        <Text
          className={cn(
            'font-sans text-[15px] leading-5 tracking-[0.01em]',
            selected ? 'font-sans-md text-ink' : 'text-mist/90',
          )}>
          {label}
        </Text>
      </View>
      {selected ? (
        <View className="h-1.5 w-1.5 rounded-full bg-accent" accessibilityElementsHidden />
      ) : (
        <View className="h-1.5 w-1.5" accessibilityElementsHidden />
      )}
    </Pressable>
  );
}

export function MarketCurrencySection() {
  const countryCode = useMarketStore((s) => s.countryCode);
  const currencyCode = useMarketStore((s) => s.currencyCode);
  const setMarket = useMarketStore((s) => s.setMarket);
  const { data: options, isPending, isError } = useMarketOptions();

  const rows = useMemo(() => options ?? [], [options]);

  const onSelect = async (nextCountry: string, nextCurrency: string) => {
    if (nextCountry === countryCode && nextCurrency === currencyCode) return;
    hapticLight();
    await setMarket(nextCountry, nextCurrency);
    showToast({ variant: 'info', title: `Prices now shown in ${nextCurrency}` });
  };

  return (
    <View>
      <Text variant="body" className="mb-4 text-mist">
        Choose the currency for product prices and checkout. Options come from your Shopify store
        markets.
      </Text>

      {isPending ? (
        <View className="items-center py-6">
          <ActivityIndicator />
        </View>
      ) : isError || !rows.length ? (
        <Text variant="caption" className="text-muted">
          Could not load currencies. Check your Shopify connection and try again.
        </Text>
      ) : (
        <View>
          {rows.map((option, index) => (
            <MarketOptionRow
              key={`${option.currencyCode}-${option.countryCode}`}
              label={option.currencyCode}
              selected={
                option.countryCode === countryCode && option.currencyCode === currencyCode
              }
              showDivider={index < rows.length - 1}
              onPress={() => void onSelect(option.countryCode, option.currencyCode)}
            />
          ))}
        </View>
      )}
    </View>
  );
}
