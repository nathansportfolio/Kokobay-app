import type { ReactNode } from 'react';
import { View } from 'react-native';

import type { AccountModeTransitionDirection } from '@/hooks/use-account-mode';

type AccountModeTransitionProps = {
  modeKey: string;
  direction: AccountModeTransitionDirection;
  children: ReactNode;
};

/** Plain swap — Reanimated enter/exit left content at 0 height on some Android builds. */
export function AccountModeTransition({ modeKey, children }: AccountModeTransitionProps) {
  return <View key={modeKey}>{children}</View>;
}
