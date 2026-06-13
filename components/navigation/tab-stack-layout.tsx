import { StackActions } from '@react-navigation/native';
import { Stack, useNavigation } from 'expo-router';
import { useEffect } from 'react';
import { Platform } from 'react-native';

import { palette } from '@/constants/theme';

/** NativeTabs skips JS pop-to-top — reset nested home stack when the tab is re-selected. */
function usePopStackOnTabPress() {
  const navigation = useNavigation();

  useEffect(() => {
    const tabNav = navigation.getParent();
    if (!tabNav) return;

    const unsubscribe = tabNav.addListener('tabPress', () => {
      if (!navigation.isFocused() || !navigation.canGoBack()) return;

      requestAnimationFrame(() => {
        navigation.dispatch(StackActions.popToTop());
      });
    });

    return unsubscribe;
  }, [navigation]);
}

/** Full-bleed stack — no navigator-level top padding; screens clear chrome with spacers. */
export default function TabStackLayout() {
  usePopStackOnTabPress();

  return (
    <Stack
      initialRouteName="index"
      screenOptions={{
        headerShown: false,
        freezeOnBlur: false,
        contentStyle: {
          flex: 1,
          backgroundColor: palette.canvas,
        },
        ...(Platform.OS === 'ios' ? { fullScreenGestureEnabled: true } : null),
      }}>
      {/*
        Full-screen back swipe steals horizontal pans on the PDP gallery.
        Edge swipe-back still works with gestureEnabled (default).
      */}
      <Stack.Screen
        name="product/[handle]"
        options={Platform.OS === 'ios' ? { fullScreenGestureEnabled: false } : undefined}
      />
    </Stack>
  );
}
