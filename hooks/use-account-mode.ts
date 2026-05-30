import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';

import type { AccountAuthenticatedView, AccountGuestMode } from '@/types/account-mode';
import { parseAccountModeParam } from '@/types/account-mode';

export type AccountModeTransitionDirection = 'forward' | 'back';

type UseAccountModeOptions = {
  isAuthenticated: boolean;
};

export function useAccountMode({ isAuthenticated }: UseAccountModeOptions) {
  const router = useRouter();
  const { mode: modeParam, returnTo: returnToParam } = useLocalSearchParams<{
    mode?: string | string[];
    returnTo?: string | string[];
  }>();

  const [modeStack, setModeStack] = useState<AccountGuestMode[]>(['landing']);
  const [authenticatedView, setAuthenticatedView] = useState<AccountAuthenticatedView>('dashboard');
  const [returnTo, setReturnTo] = useState<string | null>(null);
  const directionRef = useRef<AccountModeTransitionDirection>('forward');
  const [transitionDirection, setTransitionDirection] = useState<AccountModeTransitionDirection>('forward');

  const currentGuestMode = modeStack[modeStack.length - 1] ?? 'landing';
  const canGoBack = modeStack.length > 1;

  const applyDirection = useCallback((direction: AccountModeTransitionDirection) => {
    directionRef.current = direction;
    setTransitionDirection(direction);
  }, []);

  const pushMode = useCallback(
    (mode: AccountGuestMode) => {
      if (isAuthenticated) return;
      applyDirection('forward');
      setModeStack((prev) => {
        if (prev[prev.length - 1] === mode) return prev;
        return [...prev, mode];
      });
    },
    [applyDirection, isAuthenticated],
  );

  const switchMode = useCallback(
    (mode: AccountGuestMode) => {
      if (isAuthenticated) return;
      applyDirection('forward');
      setModeStack((prev) => {
        if (prev.length === 0) return ['landing', mode];
        if (prev.length === 1 && prev[0] === 'landing') return ['landing', mode];
        return [...prev.slice(0, -1), mode];
      });
    },
    [applyDirection, isAuthenticated],
  );

  const popMode = useCallback(() => {
    applyDirection('back');
    setModeStack((prev) => (prev.length > 1 ? prev.slice(0, -1) : prev));
  }, [applyDirection]);

  const resetToLanding = useCallback(() => {
    applyDirection('back');
    setModeStack(['landing']);
    setAuthenticatedView('dashboard');
    setReturnTo(null);
  }, [applyDirection]);

  const openSettings = useCallback(() => {
    applyDirection('forward');
    if (isAuthenticated) {
      setAuthenticatedView('settings');
      return;
    }
    setModeStack((prev) => {
      if (prev[prev.length - 1] === 'settings') return prev;
      return [...prev, 'settings'];
    });
  }, [applyDirection, isAuthenticated]);

  const closeSettings = useCallback(() => {
    applyDirection('back');
    if (isAuthenticated) {
      setAuthenticatedView('dashboard');
      return;
    }
    setModeStack((prev) => (prev.length > 1 ? prev.slice(0, -1) : prev));
  }, [applyDirection, isAuthenticated]);

  useEffect(() => {
    if (isAuthenticated) {
      setModeStack(['landing']);
      setReturnTo(null);
    } else {
      setAuthenticatedView('dashboard');
    }
  }, [isAuthenticated]);

  useFocusEffect(
    useCallback(() => {
      const parsedMode = parseAccountModeParam(modeParam);
      if (!parsedMode) return;

      const rawReturnTo =
        typeof returnToParam === 'string' ? returnToParam
        : Array.isArray(returnToParam) ? returnToParam[0]
        : undefined;

      if (rawReturnTo?.trim()) {
        setReturnTo(rawReturnTo.trim());
      }

      if (parsedMode === 'settings') {
        openSettings();
        router.setParams({ mode: undefined, returnTo: undefined });
        return;
      }

      if (isAuthenticated) return;

      pushMode(parsedMode);
      router.setParams({ mode: undefined, returnTo: undefined });
    }, [isAuthenticated, modeParam, openSettings, pushMode, returnToParam, router]),
  );

  const openSignIn = useCallback(() => {
    if (isAuthenticated) return;
    applyDirection('forward');
    setModeStack(['landing', 'signin']);
  }, [applyDirection, isAuthenticated]);

  return {
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
    clearReturnTo: () => setReturnTo(null),
  };
}
