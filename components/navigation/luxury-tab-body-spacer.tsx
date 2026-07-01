import { useEffect, useRef } from 'react';
import { View, type LayoutChangeEvent } from 'react-native';
import { usePathname } from 'expo-router';

import { useScrollTopPadding } from '@/contexts/chrome-context';
import { logPlpChromeSnap } from '@/lib/plp-chrome-snap-trace';

/** Clears the fixed tab header (status bar + chrome + optional incident banner) before content. */
export function LuxuryTabBodySpacer() {
  const pathname = usePathname();
  const spacerHeight = useScrollTopPadding();
  const prevHeightRef = useRef<number | null>(null);

  useEffect(() => {
    if (prevHeightRef.current === spacerHeight) return;
    const prev = prevHeightRef.current;
    prevHeightRef.current = spacerHeight;
    logPlpChromeSnap('luxury_tab_body_spacer', {
      pathname,
      spacerHeight,
      prevHeight: prev,
      delta: prev != null ? spacerHeight - prev : 0,
    });
  }, [pathname, spacerHeight]);

  const onLayout = (event: LayoutChangeEvent) => {
    const { height } = event.nativeEvent.layout;
    logPlpChromeSnap('luxury_tab_body_spacer_layout', { pathname, layoutHeight: height });
  };

  return <View style={{ height: spacerHeight }} onLayout={onLayout} />;
}
