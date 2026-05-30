import type { ReactNode } from 'react';
import { useCallback, useRef } from 'react';
import { ScrollView, View } from 'react-native';
import type { Edge } from 'react-native-safe-area-context';
import { SafeAreaView } from 'react-native-safe-area-context';

import { LuxuryRefreshControl } from '@/components/ui/luxury-refresh-control';
import { palette } from '@/constants/theme';
import { useBindScrollToTop } from '@/contexts/scroll-to-top-context';
import { cn } from '@/utils/cn';

/** Inline flex shells — NativeWind flex-1 on ScrollView / SafeAreaView fails on Android. */
const shellCanvas = { flex: 1, backgroundColor: palette.canvas } as const;

const screenScrollContentStyle = {
  flexGrow: 1,
  paddingHorizontal: 20,
  paddingBottom: 40,
  paddingTop: 8,
} as const;

export type ScreenProps = {
  children: ReactNode;
  /** When true, content scrolls inside safe area */
  scroll?: boolean;
  className?: string;
  contentClassName?: string;
  edges?: Edge[];
  /** Pull-to-refresh (scroll mode only) */
  refreshing?: boolean;
  onRefresh?: () => void;
};

export function Screen({
  children,
  scroll = false,
  className,
  contentClassName,
  edges = ['top', 'left', 'right'],
  refreshing,
  onRefresh,
}: ScreenProps) {
  const scrollRef = useRef<ScrollView>(null);
  const scrollToTop = useCallback(() => {
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  }, []);
  const { onScroll } = useBindScrollToTop(scrollToTop, scroll);

  if (scroll) {
    const refresh =
      onRefresh != null ? (
        <LuxuryRefreshControl refreshing={Boolean(refreshing)} onRefresh={onRefresh} />
      ) : undefined;

    return (
      <SafeAreaView style={shellCanvas} className={className} edges={edges}>
        <View style={shellCanvas} collapsable={false}>
          <ScrollView
            ref={scrollRef}
            style={shellCanvas}
            contentContainerStyle={screenScrollContentStyle}
            contentContainerClassName={contentClassName}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            onScroll={onScroll}
            scrollEventThrottle={16}
            refreshControl={refresh}>
            {children}
          </ScrollView>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={shellCanvas} className={className} edges={edges}>
      <View style={shellCanvas} className={cn('px-5 pt-2', contentClassName)}>
        {children}
      </View>
    </SafeAreaView>
  );
}
