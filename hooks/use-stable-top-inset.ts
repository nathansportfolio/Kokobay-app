import { initialWindowMetrics, useSafeAreaInsets } from 'react-native-safe-area-context';

/** Avoids a layout jump when safe-area insets resolve after the first paint. */
export function useStableTopInset(): number {
  const insets = useSafeAreaInsets();
  const fallback = initialWindowMetrics?.insets.top ?? 0;
  return Math.max(insets.top, fallback);
}
