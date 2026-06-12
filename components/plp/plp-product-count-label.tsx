import { View } from 'react-native';

import { Text } from '@/components/ui/text';
import { formatPlpProductCount } from '@/utils/plp';

export type PlpProductCountLabelProps = {
  count: number;
  /** Hide while the first catalog slice is still loading. */
  visible: boolean;
  /** Keep one caption line of height while loading so the PLP header does not grow. */
  reserveSpace?: boolean;
};

/** Matches caption line + `mt-1` under the PLP title. */
const PLP_PRODUCT_COUNT_LINE_HEIGHT = 20;

export function PlpProductCountLabel({
  count,
  visible,
  reserveSpace = false,
}: PlpProductCountLabelProps) {
  if (!visible) {
    if (!reserveSpace) {
      return null;
    }
    return <View style={{ height: PLP_PRODUCT_COUNT_LINE_HEIGHT }} />;
  }

  return (
    <Text variant="caption" className="mt-1 text-center">
      {formatPlpProductCount(count)}
    </Text>
  );
}
