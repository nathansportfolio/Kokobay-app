import { useFocusEffect } from '@react-navigation/native';
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
} from 'react';
import {
  Pressable,
  View,
  type NativeSyntheticEvent,
  type NativeScrollEvent,
} from 'react-native';
import { usePathname } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { palette } from '@/constants/theme';
import { hapticLight } from '@/utils/haptics';

const SHOW_AFTER_Y = 200;

/** PDP: tab bar + sticky "Add to bag" row + small gap — FAB anchors to window bottom, CTA does not */
const PDP_SCROLL_TO_TOP_BOTTOM_OFFSET = 158;

const FAB_SIZE = 48;
const FAB_RADIUS = FAB_SIZE / 2;

type Registration = { id: number; scrollToTop: () => void };

type ScrollToTopContextValue = {
  registerScrollToTop: (scrollToTop: () => void) => () => void;
  reportScrollY: (y: number) => void;
  resetScrollTracking: () => void;
};

const ScrollToTopContext = createContext<ScrollToTopContextValue | null>(null);

export function ScrollToTopProvider({ children }: PropsWithChildren) {
  const activeRef = useRef<Registration | null>(null);
  const idRef = useRef(0);
  const [fabVisible, setFabVisible] = useState(false);

  const registerScrollToTop = useCallback((scrollToTop: () => void) => {
    const id = ++idRef.current;
    activeRef.current = { id, scrollToTop };
    return () => {
      if (activeRef.current?.id === id) {
        activeRef.current = null;
      }
    };
  }, []);

  const reportScrollY = useCallback((y: number) => {
    setFabVisible(y > SHOW_AFTER_Y);
  }, []);

  const resetScrollTracking = useCallback(() => {
    setFabVisible(false);
  }, []);

  const value = useMemo(
    () => ({ registerScrollToTop, reportScrollY, resetScrollTracking }),
    [registerScrollToTop, reportScrollY, resetScrollTracking],
  );

  const onFabPress = useCallback(() => {
    hapticLight();
    activeRef.current?.scrollToTop();
  }, []);

  return (
    <ScrollToTopContext.Provider value={value}>
      <View style={{ flex: 1 }} collapsable={false}>
        {children}
        <ScrollToTopFab visible={fabVisible} onPress={onFabPress} />
      </View>
    </ScrollToTopContext.Provider>
  );
}

function ScrollToTopFab({ visible, onPress }: { visible: boolean; onPress: () => void }) {
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  /** Stack routes (search overlay, checkout) sit above the tab bar; tab stack uses default lift. */
  const noTabBar =
    pathname === '/search' ||
    pathname === '/search-overlay' ||
    pathname.startsWith('/checkout');
  const isPdp = /\/product\//.test(pathname);
  const bottomLift = noTabBar ? 20 : isPdp ? PDP_SCROLL_TO_TOP_BOTTOM_OFFSET : 56;

  if (!visible || pathname === '/cart' || pathname === '/search-overlay') {
    return null;
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Scroll to top"
      onPress={onPress}
      hitSlop={8}
      className="absolute active:opacity-88"
      style={{
        zIndex: 100,
        bottom: insets.bottom + bottomLift,
        right: 18,
        width: FAB_SIZE,
        height: FAB_SIZE,
        borderRadius: FAB_RADIUS,
        backgroundColor: palette.ink,
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 4,
        elevation: 6,
      }}>
      <IconSymbol name="chevron.up" size={22} color="#FFFFFF" />
    </Pressable>
  );
}

/**
 * Call from a screen that owns the main vertical scroll: registers scroll-to-top while focused
 * and returns `onScroll` to drive FAB visibility.
 */
export function useBindScrollToTop(scrollToTop: () => void, enabled = true) {
  const ctx = useContext(ScrollToTopContext);

  useFocusEffect(
    useCallback(() => {
      if (!enabled || !ctx) return undefined;
      ctx.resetScrollTracking();
      const unregister = ctx.registerScrollToTop(scrollToTop);
      return () => {
        unregister();
        ctx.resetScrollTracking();
      };
    }, [enabled, ctx, scrollToTop]),
  );

  const onScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      ctx?.reportScrollY(e.nativeEvent.contentOffset.y);
    },
    [ctx],
  );

  return { onScroll };
}
