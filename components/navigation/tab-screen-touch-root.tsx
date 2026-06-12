import { useIsFocused } from '@react-navigation/native';
import type { PropsWithChildren } from 'react';
import { Platform, View } from 'react-native';

/**
 * NativeTabs keeps every tab screen mounted in the same absolute frame. On iOS the
 * last-mounted sibling wins hit-testing, so unfocused tabs swallow touches on the
 * focused tab. Disable pointer events on inactive tabs (expo/expo#44778).
 */
export function TabScreenTouchRoot({ children }: PropsWithChildren) {
  const isFocused = useIsFocused();

  if (Platform.OS !== 'ios') {
    return children;
  }

  return (
    <View
      style={{ flex: 1 }}
      collapsable={false}
      pointerEvents={isFocused ? 'box-none' : 'none'}>
      {children}
    </View>
  );
}
