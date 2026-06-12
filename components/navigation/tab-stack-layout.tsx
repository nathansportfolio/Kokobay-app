import { Stack } from 'expo-router';
import { Platform } from 'react-native';

import { palette } from '@/constants/theme';

/** Full-bleed stack — no navigator-level top padding; screens clear chrome with spacers. */
export default function TabStackLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        freezeOnBlur: false,
        contentStyle: {
          flex: 1,
          backgroundColor: palette.canvas,
        },
        ...(Platform.OS === 'ios' ? { fullScreenGestureEnabled: true } : null),
      }}
    />
  );
}
