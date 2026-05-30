import { useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ACCOUNT_ORDERS_QUERY_KEY } from '@/components/account/account-orders-section';
import { LuxuryTabBodySpacer } from '@/components/navigation/luxury-tab-body-spacer';
import { LuxuryTabScreenHeader } from '@/components/navigation/luxury-tab-screen-header';
import { AccountAppSettings } from '@/components/account/account-app-settings';
import { AccountDashboard } from '@/components/account/account-dashboard';
import { AccountForgotPasswordForm } from '@/components/account/account-forgot-password-form';
import { AccountLanding } from '@/components/account/account-landing';
import { AccountModeTransition } from '@/components/account/account-mode-transition';
import { AccountSignInForm } from '@/components/account/account-sign-in-form';
import { AccountSignUpForm } from '@/components/account/account-sign-up-form';
import { LuxuryRefreshControl } from '@/components/ui/luxury-refresh-control';
import { palette } from '@/constants/theme';
import { useBindScrollToTop } from '@/contexts/scroll-to-top-context';
import { useAccountMode } from '@/hooks/use-account-mode';
import { useGlobalPullToRefresh } from '@/hooks/use-pull-to-refresh';
import { useOptionalBottomTabBarHeight } from '@/hooks/use-optional-bottom-tab-bar-height';
import { useAuthStore } from '@/store';
import { isAllowedCheckoutUrl } from '@/utils/checkout-url';

/** Inline shells — NativeWind flex-1 on ScrollView / SafeAreaView fails on Android. */
const ACCOUNT_SHELL = { flex: 1, backgroundColor: palette.canvas } as const;
const ACCOUNT_SCROLL_CONTENT = {
  flexGrow: 1,
  paddingHorizontal: 20,
  paddingBottom: 40,
  paddingTop: 8,
} as const;

export default function AccountScreen() {
  const router = useRouter();
  const tabBarHeight = useOptionalBottomTabBarHeight();
  const { height: winH } = useWindowDimensions();
  /** Explicit height — flex:1 ScrollView collapses on Android (guest auth forms). */
  const scrollHeight = Math.max(320, winH - tabBarHeight);
  const { orderId, orderNumber } = useLocalSearchParams<{
    orderId?: string;
    orderNumber?: string;
  }>();
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const accessToken = useAuthStore((s) => s.accessToken);
  const hasHydrated = useAuthStore((s) => s.hasHydrated);
  const logout = useAuthStore((s) => s.logout);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const settingsRefreshRef = useRef<(() => Promise<void>) | null>(null);
  const scrollRef = useRef<ScrollView>(null);

  const {
    currentGuestMode,
    authenticatedView,
    canGoBack,
    transitionDirection,
    pushMode,
    switchMode,
    popMode,
    resetToLanding,
    openSignIn,
    openSettings,
    closeSettings,
    returnTo,
    clearReturnTo,
  } = useAccountMode({ isAuthenticated: Boolean(user) });

  const scrollToTop = useCallback(() => {
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  }, []);
  const { onScroll } = useBindScrollToTop(scrollToTop, hasHydrated);

  const registerSettingsRefresh = useCallback((refresh: (() => Promise<void>) | null) => {
    settingsRefreshRef.current = refresh;
  }, []);

  const onLogout = useCallback(async () => {
    setIsLoggingOut(true);
    try {
      await logout();
      resetToLanding();
    } finally {
      setIsLoggingOut(false);
    }
  }, [logout, resetToLanding]);

  const onRequestSignIn = useCallback(async () => {
    setIsLoggingOut(true);
    try {
      await logout();
    } finally {
      setIsLoggingOut(false);
      openSignIn();
    }
  }, [logout, openSignIn]);

  const onSignInSuccess = useCallback(() => {
    const checkoutUrl = returnTo?.trim();
    if (checkoutUrl && isAllowedCheckoutUrl(checkoutUrl)) {
      clearReturnTo();
      router.replace({ pathname: '/checkout', params: { url: checkoutUrl } });
      return;
    }
    clearReturnTo();
  }, [clearReturnTo, returnTo, router]);

  const onCheckoutBack = useCallback(
    (checkoutUrl: string) => {
      clearReturnTo();
      router.replace({ pathname: '/checkout', params: { url: checkoutUrl } });
    },
    [clearReturnTo, router],
  );

  const { refreshing, onRefresh } = useGlobalPullToRefresh(async () => {
    if (user && accessToken && authenticatedView === 'dashboard') {
      await queryClient.refetchQueries({ queryKey: [...ACCOUNT_ORDERS_QUERY_KEY, accessToken] });
    }
    if (settingsRefreshRef.current) {
      await settingsRefreshRef.current();
    }
  });

  const settingsPanel = (
    <AccountAppSettings
      canGoBack
      onBack={closeSettings}
      onRegisterRefresh={registerSettingsRefresh}
    />
  );

  const body = user ?
    <AccountModeTransition modeKey={authenticatedView} direction={transitionDirection}>
      {authenticatedView === 'settings' ?
        settingsPanel
      : <AccountDashboard
          user={user}
          accessToken={accessToken}
          openOrderId={typeof orderId === 'string' ? orderId : undefined}
          openOrderNumber={typeof orderNumber === 'string' ? orderNumber : undefined}
          isLoggingOut={isLoggingOut}
          onLogout={onLogout}
          onRequestSignIn={onRequestSignIn}
          onOpenSettings={openSettings}
        />
      }
    </AccountModeTransition>
  : <AccountModeTransition modeKey={currentGuestMode} direction={transitionDirection}>
      {currentGuestMode === 'landing' ?
        <AccountLanding
          onSignIn={() => pushMode('signin')}
          onCreateAccount={() => pushMode('signup')}
          onForgotPassword={() => pushMode('forgotPassword')}
          onOpenSettings={openSettings}
        />
      : currentGuestMode === 'signin' ?
        <AccountSignInForm
          canGoBack={canGoBack}
          returnTo={returnTo}
          onBack={popMode}
          onCheckoutBack={onCheckoutBack}
          onSuccess={onSignInSuccess}
          onForgotPassword={() => pushMode('forgotPassword')}
          onCreateAccount={() => switchMode('signup')}
          onOpenSettings={openSettings}
        />
      : currentGuestMode === 'signup' ?
        <AccountSignUpForm
          canGoBack={canGoBack}
          onBack={popMode}
          onSignIn={() => switchMode('signin')}
        />
      : currentGuestMode === 'settings' ?
        settingsPanel
      : <AccountForgotPasswordForm
          canGoBack={canGoBack}
          onBack={popMode}
          onSignIn={() => switchMode('signin')}
        />
      }
    </AccountModeTransition>;

  const showsTabTitleHeader =
    (Boolean(user) && authenticatedView === 'dashboard') ||
    (!user && currentGuestMode === 'landing');

  if (!hasHydrated) {
    return (
      <SafeAreaView style={ACCOUNT_SHELL} edges={['left', 'right']}>
        <View style={ACCOUNT_SHELL}>
          <LuxuryTabScreenHeader title="Account" />
          <View style={{ alignItems: 'center', paddingVertical: 72 }}>
            <ActivityIndicator color={palette.accent} />
          </View>
        </View>
      </SafeAreaView>
    );
  }

  const chrome = (
    <>
      {!showsTabTitleHeader ? <LuxuryTabBodySpacer /> : null}
      {body}
    </>
  );

  const scrollStyle = user
    ? ACCOUNT_SHELL
    : { height: scrollHeight, backgroundColor: palette.canvas };

  return (
    <SafeAreaView style={ACCOUNT_SHELL} edges={['left', 'right']}>
      <View style={ACCOUNT_SHELL} collapsable={false}>
        <ScrollView
          ref={scrollRef}
          style={scrollStyle}
          contentContainerStyle={ACCOUNT_SCROLL_CONTENT}
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets
          showsVerticalScrollIndicator={false}
          onScroll={onScroll}
          scrollEventThrottle={16}
          refreshControl={
            user ?
              <LuxuryRefreshControl refreshing={refreshing} onRefresh={onRefresh} />
            : undefined
          }>
          {chrome}
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}
