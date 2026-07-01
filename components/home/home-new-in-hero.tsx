import { Image } from 'expo-image';
import { Link, usePathname } from 'expo-router';
import { memo, useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { catalogImageCache } from '@/constants/expo-image';
import { LUXURY_RADIUS } from '@/constants/luxury-design-system';
import { useAppHomeHeroContent } from '@/hooks/use-app-home-hero-content';
import { hapticLight } from '@/utils/haptics';
import { openExternalHomeHeroLink } from '@/utils/home-hero-link';

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
  const hero = useAppHomeHeroContent(width, pathname);
  const hasKicker = hero.kicker.length > 0;
  const hasCta = hero.ctaLabel.length > 0;
  const hasCopy = hasKicker || hasCta;
  const ctaTarget = hero.ctaTarget;
  const isUnderlineCta = hero.buttonStyle === 'underline';
  const ctaPressable = (onPress?: () => void) => (
    <Pressable
      onPressIn={() => hapticLight()}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={hero.ctaLabel}
      android_ripple={
        isUnderlineCta ? undefined : { color: 'rgba(0,0,0,0.08)', borderless: false }
      }
      style={({ pressed }) => [
        isUnderlineCta ? styles.ctaTextHit : styles.ctaHit,
        pressed && styles.ctaPressed,
      ]}>
      {isUnderlineCta ? (
        <Text style={styles.ctaTextLink}>{hero.ctaLabel}</Text>
      ) : (
        <View
          style={[styles.ctaPill, { backgroundColor: hero.buttonBackgroundColor }]}
          collapsable={false}>
          <Text style={[styles.ctaLabel, { color: hero.buttonTextColor }]}>{hero.ctaLabel}</Text>
        </View>
      )}
    </Pressable>
  );

  return (
    <View style={{ width, height }}>
      <Image
        source={{ uri: hero.imageUri }}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        accessibilityIgnoresInvertColors
        recyclingKey={hero.fromCms ? 'home-hero-cms' : 'home-new-in-hero'}
        {...catalogImageCache}
        priority="high"
      />
      {hasCopy ? (
        <View pointerEvents="none" style={[StyleSheet.absoluteFillObject, styles.heroScrim]} />
      ) : null}
      {hasCopy ? (
        <View
          style={[styles.copyBlock, { paddingBottom: HERO_COPY_BOTTOM }]}
          pointerEvents="box-none">
          <View style={[styles.copyStack, { gap: HERO_KICKER_CTA_GAP }]}>
            {hasKicker ? (
              <Text style={[styles.kicker, { color: hero.textColor }]}>{hero.kicker}</Text>
            ) : null}
            {hasCta ? (
              ctaTarget.kind === 'internal' ? (
                <Link href={ctaTarget.href} asChild>
                  {ctaPressable()}
                </Link>
              ) : (
                ctaPressable(() => openExternalHomeHeroLink(ctaTarget.url))
              )
            ) : null}
          </View>
        </View>
      ) : null}
    </View>
  );
}

export const HomeNewInHero = memo(HomeNewInHeroInner);

const styles = StyleSheet.create({
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
    fontSize: 28,
    letterSpacing: 1.6,
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.35)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 12,
  },
  ctaHit: {
    alignSelf: 'center',
    borderRadius: LUXURY_RADIUS.none,
    overflow: 'hidden',
  },
  ctaTextHit: {
    alignSelf: 'center',
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  ctaPill: {
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: LUXURY_RADIUS.none,
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
  },
  ctaTextLink: {
    fontFamily: 'InstrumentSans-SemiBold',
    fontSize: 12,
    letterSpacing: 2.2,
    color: '#FFFFFF',
    textDecorationLine: 'underline',
    textShadowColor: 'rgba(0, 0, 0, 0.35)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 12,
  },
});
