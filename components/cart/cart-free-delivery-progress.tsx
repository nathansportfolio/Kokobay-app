import { View } from 'react-native';

import { Text } from '@/components/ui/text';
import { DEFAULT_FREE_DELIVERY_THRESHOLD_GBP } from '@/constants/delivery-threshold';
import { formatCartMoney } from '@/utils/money';

type Money = { amount: string; currencyCode: string };

type Props = {
  subtotal: Money;
  /** From CMS `delivery_threshold`; defaults to 100. */
  freeDeliveryThresholdGbp?: number;
};

/** UK free-delivery nudge — shown on the bag screen for GBP baskets only. */
export function CartFreeDeliveryProgress({ subtotal, freeDeliveryThresholdGbp }: Props) {
  if (subtotal.currencyCode.trim().toUpperCase() !== 'GBP') return null;

  const subtotalN = Number.parseFloat(subtotal.amount);
  if (!Number.isFinite(subtotalN) || subtotalN <= 0) return null;

  const threshold =
    freeDeliveryThresholdGbp != null &&
    Number.isFinite(freeDeliveryThresholdGbp) &&
    freeDeliveryThresholdGbp > 0
      ? freeDeliveryThresholdGbp
      : DEFAULT_FREE_DELIVERY_THRESHOLD_GBP;
  const progress = Math.min(1, subtotalN / threshold);
  const remaining = Math.max(0, threshold - subtotalN);
  const unlocked = remaining <= 0.005;
  const remainingLabel = formatCartMoney({
    amount: remaining.toFixed(2),
    currencyCode: 'GBP',
  });

  return (
    <View className="mb-8">
      <Text
        className="mb-2.5 font-sans-md text-[13px] leading-5 text-ink/88"
        accessibilityRole="text">
        {unlocked ?
          'You\u2019ve unlocked free UK delivery'
        : `Spend ${remainingLabel} more for free delivery`}
      </Text>
      <View
        accessibilityRole="progressbar"
        accessibilityValue={{ min: 0, max: threshold, now: Math.min(subtotalN, threshold) }}
        className="h-1.5 overflow-hidden rounded-full bg-line/45">
        <View
          className="h-full rounded-full bg-ink/75"
          style={{ width: `${Math.round(progress * 100)}%` }}
        />
      </View>
    </View>
  );
}
