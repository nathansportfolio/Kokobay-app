import { Text } from '@/components/ui/text';
import { formatPlpProductCount } from '@/utils/plp';

export type PlpProductCountLabelProps = {
  count: number;
  /** Hide while the first catalog slice is still loading. */
  visible: boolean;
};

export function PlpProductCountLabel({ count, visible }: PlpProductCountLabelProps) {
  if (!visible) {
    return null;
  }

  return (
    <Text variant="caption" className="mt-1 text-center">
      {formatPlpProductCount(count)}
    </Text>
  );
}
