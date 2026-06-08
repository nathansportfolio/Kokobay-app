import { useQueryClient } from '@tanstack/react-query';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Platform, ScrollView, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { accountQueryKeys } from '@/src/core/query/query-keys';
import { LuxuryTabBodySpacer } from '@/components/navigation/luxury-tab-body-spacer';
import { LuxuryTabScreenHeader } from '@/components/navigation/luxury-tab-screen-header';
import { AccountAppSettings } from '@/components/account/account-app-settings';
import { AccountDashboard } from '@/components/account/account-dashboard';
import { AccountForgotPasswordForm } from '@/components/account/account-forgot-password-form';
import { AccountLanding } from '@/components/account/account-landing';
import { AccountModeTransition } from '@/components/account/account-mode-transition';
import { AccountSignInForm } from '@/components/account/account-sign-in-form';
import { AccountSignUpForm } from '@/components/account/account-sign-up-form';
import { palette } from '@/constants/theme';
import { useBindScrollToTop } from '@/contexts/scroll-to-top-context';
import { useAccountMode } from '@/hooks/use-account-mode';
import { useOptionalBottomTabBarHeight } from '@/hooks/use-optional-bottom-tab-bar-height';
import { markSignOutPerf } from '@/lib/sign-out-perf';
import { useAuth } from '@/hooks/use-auth';
import { useAuthStore } from '@/store';
import { isAllowedCheckoutUrl } from '@/utils/checkout-url';

/** Inline shells — NativeWind flex-1 on ScrollView / SafeAreaView fails on Android. */
const ACCOUNT_SHELL = { flex: 1, backgroundColor: '#FAF8F5' } as const;
/** flexGrow + RefreshControl blanks ScrollView children on Android — avoid for logged-in. */
const ACCOUNT_SCROLL_CONTENT = {
  paddingHorizontal: 22,
  paddingBottom: 40,
  paddingTop: 8,
} as const;

const ACCOUNT_SCROLL_CONTENT_GUEST = {
  ...ACCOUNT_SCROLL_CONTENT,
  flexGrow: 1,
} as const;

export default function AccountScreen() {
  const router = useRouter();
  const tabBarHeight = useOptionalBottomTabBarHeight();
  const { height: winH } = useWindowDimensions();
  /** Explicit height — flex:1 ScrollView collapses on Android (guest + logged-in). */
  const scrollHeight = Math.max(320, winH - tabBarHeight);
  const scrollStyle = { height: scrollHeight, backgroundColor: '#FAF8F5' } as const;
  const { orderId, orderNumber } = useLocalSearchParams<{
    orderId?: string;
    orderNumber?: string;
  }>();
  const queryClient = useQueryClient();
  const { user, isReady, isAuthenticated } = useAuth();
  const logout = useAuthStore((s) => s.logout);
  const clearSessionAfterAccountDeletion = useAuthStore((s) => s.clearSessionAfterAccountDeletion);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const settingsRefreshRef = useRef<(() => Promise<void>) | null>(null);
  const scrollRef = useRef<ScrollView>(null);

  const {
    currentGuestMode,
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
  } = useAccountMode({ isAuthenticated });

  const scrollToTop = useCallback(() => {
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  }, []);
  const { onScroll } = useBindScrollToTop(scrollToTop, isReady);

  const registerSettingsRefresh = useCallback((refresh: (() => Promise<void>) | null) => {
    settingsRefreshRef.current = refresh;
  }, []);

  const signOutAndReset = useCallback(async () => {
    setIsLoggingOut(true);
    try {
      await logout();
      resetToLanding();
      markSignOutPerf('guest_account_screen');
    } finally {
      setIsLoggingOut(false);
    }
  }, [logout, resetToLanding]);

  const onLogout = signOutAndReset;

  const onAccountDeletionRequested = useCallback(async () => {
    setIsLoggingOut(true);
    try {
      await clearSessionAfterAccountDeletion();
      resetToLanding();
      markSignOutPerf('guest_account_screen');
    } finally {
      setIsLoggingOut(false);
    }
  }, [clearSessionAfterAccountDeletion, resetToLanding]);

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

  useFocusEffect(
    useCallback(() => {
      if (!user?.id || !isAuthenticated) return;
      void queryClient.refetchQueries({
        queryKey: accountQueryKeys.orders(user.id),
        type: 'active',
      });
    }, [isAuthenticated, queryClient, user?.id]),
  );

  const settingsPanel = (
    <AccountAppSettings
      canGoBack
      onBack={closeSettings}
      onRegisterRefresh={registerSettingsRefresh}
    />
  );

  const body = user ?
    <AccountModeTransition modeKey="dashboard" direction={transitionDirection}>
      <AccountDashboard
        user={user}
        openOrderId={typeof orderId === 'string' ? orderId : undefined}
        openOrderNumber={typeof orderNumber === 'string' ? orderNumber : undefined}
        isLoggingOut={isLoggingOut}
        onLogout={onLogout}
        onAccountDeletionRequested={onAccountDeletionRequested}
        onRequestSignIn={onRequestSignIn}
        onRegisterRefresh={registerSettingsRefresh}
      />
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

  const showsTabTitleHeader = Boolean(user) || (!user && currentGuestMode === 'landing');

  if (!isReady) {
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

  const scrollContentStyle = user ? ACCOUNT_SCROLL_CONTENT : ACCOUNT_SCROLL_CONTENT_GUEST;

  const scroll = (
    <ScrollView
      ref={scrollRef}
      style={scrollStyle}
      nestedScrollEnabled
      contentContainerStyle={scrollContentStyle}
      keyboardShouldPersistTaps="handled"
      automaticallyAdjustKeyboardInsets
      showsVerticalScrollIndicator={false}
      onScroll={onScroll}
      scrollEventThrottle={16}
      {...(Platform.OS === 'android' ? { overScrollMode: 'always' as const } : {})}>
      {chrome}
    </ScrollView>
  );

  if (user) {
    return (
      <View style={ACCOUNT_SHELL} collapsable={false}>
        {scroll}
      </View>
    );
  }

  return (
    <SafeAreaView style={ACCOUNT_SHELL} edges={['left', 'right']}>
      <View style={ACCOUNT_SHELL} collapsable={false}>
        {scroll}
      </View>
    </SafeAreaView>
  );
}
