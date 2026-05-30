import { GestureHandlerRootView } from 'react-native-gesture-handler';
import 'react-native-reanimated';
import { enableFreeze } from 'react-native-screens';
import '../global.css';

/** Prevents post-background freeze where scroll works but Pressables do not (react-native-screens). */
enableFreeze(false);

import { ThemeProvider } from '@react-navigation/native';
import * as SplashScreen from 'expo-splash-screen';
import { Stack } from 'expo-router';
import type { ErrorBoundaryProps } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import { useEffect, useRef, useState } from 'react';
import { View, useWindowDimensions } from 'react-native';

import { StackHeaderWithBanner } from '@/components/navigation/stack-header-with-banner';
import { AppLaunchSplash } from '@/components/app-launch-splash';
import { AppProviders } from '@/components/providers/app-providers';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { ToastHost } from '@/components/ui/toast-host';
import { navigationTheme, palette } from '@/constants/theme';
import { useAppFonts } from '@/hooks/use-app-fonts';
import { usePushNotificationSetup } from '@/hooks/use-push-notification-setup';
import {
  APP_LAUNCH_FADE_DURATION_MS,
  markAppLaunchRevealComplete,
  prepareAppLaunch,
} from '@/lib/app-launch';
import { reportAppErrorFromUnknown } from '@/lib/appErrorLog';
import { installAppErrorReporting } from '@/lib/install-app-error-reporting';

installAppErrorReporting();

SplashScreen.preventAutoHideAsync().catch(() => {});

export const unstable_settings = {
  anchor: '(tabs)',
};

export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  reportAppErrorFromUnknown(error, {
    fatal: true,
    context: { source: 'expo_router_root_error_boundary' },
  });

  return (
    <View className="flex-1 items-center justify-center bg-canvas px-8">
      <Text className="mb-2 font-sans-semibold text-[18px] text-ink">Something went wrong</Text>
      <Text className="mb-6 text-center font-sans text-[14px] text-mist">
        {__DEV__ ? error.message : 'Please try again.'}
      </Text>
      <Button title="Try again" variant="primary" onPress={retry} />
    </View>
  );
}

export default function RootLayout() {
  const [fontsLoaded] = useAppFonts();
  const { width } = useWindowDimensions();
  const [appContentReady, setAppContentReady] = useState(false);
  const launchPrepared = useRef(false);
  const splashHidden = useRef(false);

  usePushNotificationSetup(fontsLoaded && appContentReady);

  useEffect(() => {
    SystemUI.setBackgroundColorAsync(palette.canvas).catch(() => {});
  }, []);

  useEffect(() => {
    if (!fontsLoaded || launchPrepared.current) return;
    launchPrepared.current = true;

    let cancelled = false;
    void (async () => {
      await prepareAppLaunch(width);
      if (cancelled) return;
      markAppLaunchRevealComplete();
      setAppContentReady(true);
    })();

    return () => {
      cancelled = true;
    };
  }, [fontsLoaded, width]);

  useEffect(() => {
    if (!appContentReady || splashHidden.current) return;
    splashHidden.current = true;

    SplashScreen.setOptions({
      fade: true,
      duration: APP_LAUNCH_FADE_DURATION_MS,
    });
    SplashScreen.hideAsync().catch(() => {});
  }, [appContentReady]);

  if (!fontsLoaded || !appContentReady) {
    return <AppLaunchSplash />;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider value={navigationTheme}>
        <AppProviders>
          <View style={{ flex: 1, backgroundColor: palette.canvas }}>
            <Stack
              screenOptions={{
                header: (props) => <StackHeaderWithBanner {...props} />,
                headerStyle: { backgroundColor: palette.surface },
                headerTintColor: palette.ink,
                headerTitleStyle: { fontFamily: 'InstrumentSans-Medium', fontSize: 16 },
                headerShadowVisible: false,
                contentStyle: { backgroundColor: palette.canvas },
                freezeOnBlur: false,
              }}>
              <Stack.Screen
                name="(tabs)"
                options={{ headerShown: false, title: 'Home', headerBackTitle: '' }}
              />
              <Stack.Screen
                name="search-overlay"
                options={{
                  headerShown: false,
                  presentation: 'fullScreenModal',
                  animation: 'fade',
                }}
              />
              <Stack.Screen name="products/[handle]" options={{ headerShown: false }} />
              <Stack.Screen name="collections/[handle]" options={{ headerShown: false }} />
              <Stack.Screen name="account/orders/[orderId]" options={{ headerShown: false }} />
              <Stack.Screen name="wishlist" options={{ headerShown: false }} />
              <Stack.Screen name="cart" options={{ headerShown: false }} />
              <Stack.Screen
                name="content/[slug]"
                options={{ title: 'Content' }}
              />
            </Stack>
            <ToastHost />
          </View>
        </AppProviders>
      </ThemeProvider>
      <StatusBar style="dark" />
    </GestureHandlerRootView>
  );
}
