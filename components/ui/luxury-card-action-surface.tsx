import { BlurView } from 'expo-blur';
import type { ReactNode } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

/** Matches editorial card overlays — iOS blur + lift, warm white on Android */
const USE_BLUR = Platform.OS === 'ios';

export type LuxuryCardActionSize = 'xs' | 'sm' | 'md';

const DIMENSION: Record<LuxuryCardActionSize, number> = {
  xs: 30,
  sm: 36,
  md: 40,
};

/** Lucide / glyph tint on frosted actions — quiet but intentional */
export const LUXURY_CARD_ACTION_ICON_COLOR = 'rgba(32, 31, 30, 0.7)';

type Props = {
  size: LuxuryCardActionSize;
  children: ReactNode;
};

/**
 * Shared frosted circle for image-anchored actions (wishlist, quick-add, wishlist remove).
 * Calibrated for luxury PLP: white ~92%, border black/6, soft elevation.
 */
export function LuxuryCardActionSurface({ size, children }: Props) {
  const d = DIMENSION[size];

  return (
    <View style={[styles.shell, { width: d, height: d }]}>
      {USE_BLUR ? (
        <>
          <BlurView intensity={40} tint="light" style={styles.blurFill} />
          <View pointerEvents="none" style={styles.iosWhiteLift} />
          <View style={styles.center}>{children}</View>
        </>
      ) : (
        <View style={styles.androidFill}>{children}</View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    borderRadius: 999,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.06)',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 4,
  },
  blurFill: {
    ...StyleSheet.absoluteFillObject,
  },
  iosWhiteLift: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255, 255, 255, 0.24)',
  },
  center: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  androidFill: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
  },
});
