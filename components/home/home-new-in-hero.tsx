import { Image } from 'expo-image';
import { Link, usePathname } from 'expo-router';
import { memo, useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { catalogImageCache } from '@/constants/expo-image';
import { homeNewInHeroImageUri } from '@/constants/home-hero';
import { hapticLight } from '@/utils/haptics';
import { newInCollectionHref } from '@/utils/collection-handles';

export function homeNewInHeroHeight(screenWidth: number): number {
  return Math.round(screenWidth * 1.34);
}

const HERO_COPY_BOTTOM = 30;
const HERO_KICKER_CTA_GAP = 24;

type Props = {
  width: number;
};

function HomeNewInHeroInner({ width }: Props) {
  const pathname = usePathname();
  const height = useMemo(() => homeNewInHeroHeight(width), [width]);
  const imageUri = useMemo(() => homeNewInHeroImageUri(width), [width]);

  return (
    <View style={{ width, height }}>
      <Image
        source={{ uri: imageUri }}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        accessibilityIgnoresInvertColors
        recyclingKey="home-new-in-hero"
        {...catalogImageCache}
        priority="high"
      />
      <View pointerEvents="none" style={[StyleSheet.absoluteFillObject, styles.heroScrim]} />
      <View
        style={[styles.copyBlock, { paddingBottom: HERO_COPY_BOTTOM }]}
        pointerEvents="box-none">
        <View style={[styles.copyStack, { gap: HERO_KICKER_CTA_GAP }]}>
          <Text style={styles.kicker}>NEW IN</Text>
          <Link href={newInCollectionHref(pathname)} asChild>
            <Pressable
              onPressIn={() => hapticLight()}
              accessibilityRole="button"
              accessibilityLabel="Shop new in collection"
              android_ripple={{ color: 'rgba(0,0,0,0.08)', borderless: false }}
              style={({ pressed }) => [styles.ctaHit, pressed && styles.ctaPressed]}>
              <View style={styles.ctaPill} collapsable={false}>
                <Text style={styles.ctaLabel}>SHOP NOW</Text>
              </View>
            </Pressable>
          </Link>
        </View>
      </View>
    </View>
  );
}

export const HomeNewInHero = memo(HomeNewInHeroInner);

const styles = StyleSheet.create({
  /** Uniform veil over the full hero — keeps white type readable without a hard mid-frame edge. */
  heroScrim: {
    backgroundColor: 'rgba(0, 0, 0, 0.18)',
  },
  copyBlock: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  copyStack: {
    width: '100%',
    alignItems: 'center',
  },
  kicker: {
    fontFamily: 'InstrumentSans-Bold',
    fontSize: 34,
    letterSpacing: 2,
    color: '#FFFFFF',
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.35)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 12,
  },
  ctaHit: {
    alignSelf: 'center',
    borderRadius: 999,
    overflow: 'hidden',
  },
  ctaPill: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaPressed: {
    opacity: 0.88,
  },
  ctaLabel: {
    fontFamily: 'InstrumentSans-SemiBold',
    fontSize: 12,
    letterSpacing: 2.2,
    color: '#111111',
  },
});
