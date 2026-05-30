import { ActivityIndicator, View } from 'react-native';

import { PLP_INFINITE_FOOTER_HEIGHT } from '@/constants/plp-scroll';
import { palette } from '@/constants/theme';

type Props = {
  visible: boolean;
};

/**
 * Fixed-height footer slot for the next-page spinner.
 * Height is always reserved so mount/unmount does not shift list content.
 */
export function PlpInfiniteScrollFooter({ visible }: Props) {
  return (
    <View
      style={{ height: PLP_INFINITE_FOOTER_HEIGHT }}
      className="items-center justify-center"
      accessibilityLabel={visible ? 'Loading more products' : undefined}
      accessibilityElementsHidden={!visible}
      importantForAccessibility={visible ? 'yes' : 'no-hide-descendants'}>
      {visible ? <ActivityIndicator size="small" color={palette.mist} /> : null}
    </View>
  );
}
