import { RefreshControl, type RefreshControlProps } from 'react-native';

import { palette } from '@/constants/theme';

type Props = Pick<RefreshControlProps, 'refreshing' | 'onRefresh' | 'progressViewOffset'>;

/** Branded pull-to-refresh spinner — use on ScrollView / FlashList across the app. */
export function LuxuryRefreshControl({ refreshing, onRefresh, progressViewOffset }: Props) {
  return (
    <RefreshControl
      refreshing={refreshing}
      onRefresh={onRefresh}
      tintColor={palette.ink}
      colors={[palette.ink, palette.mist]}
      progressBackgroundColor={palette.elevated}
      progressViewOffset={progressViewOffset}
    />
  );
}
