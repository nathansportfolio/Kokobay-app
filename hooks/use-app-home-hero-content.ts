import { useMemo } from 'react';

import {
  DEFAULT_HOME_HERO_BUTTON_BG,
  DEFAULT_HOME_HERO_BUTTON_TEXT_COLOR,
  DEFAULT_HOME_HERO_CTA_LABEL,
  DEFAULT_HOME_HERO_KICKER,
  DEFAULT_HOME_HERO_TEXT_COLOR,
} from '@/constants/app-home-hero-cms';
import { homeNewInHeroImageUri } from '@/constants/home-hero';
import { useAppHomeHeroQuery } from '@/hooks/use-app-home-hero-query';
import { isKokobayWebProductsConfigured } from '@/services/kokobay-web/client';
import { homeHeroDisplayImageUri } from '@/utils/home-hero-image';
import type { HomeHeroCtaTarget } from '@/utils/home-hero-link';
import { resolveHomeHeroCtaTarget } from '@/utils/home-hero-link';

export type AppHomeHeroContent = {
  imageUri: string;
  kicker: string;
  ctaLabel: string;
  textColor: string;
  buttonBackgroundColor: string;
  buttonTextColor: string;
  ctaTarget: HomeHeroCtaTarget;
  /** True when `app_home_hero` metaobject matched; false = built-in default hero. */
  fromCms: boolean;
  loading: boolean;
};

export function useAppHomeHeroContent(screenWidth: number, pathname: string): AppHomeHeroContent {
  const enabled = isKokobayWebProductsConfigured();
  const query = useAppHomeHeroQuery();

  const cms = query.data ?? null;
  const fromCms = Boolean(cms?.imageUrl);

  const content = useMemo((): Omit<AppHomeHeroContent, 'loading'> => {
    if (fromCms && cms) {
      return {
        imageUri: homeHeroDisplayImageUri(cms.imageUrl, screenWidth),
        kicker: cms.text || DEFAULT_HOME_HERO_KICKER,
        ctaLabel: cms.buttonText || DEFAULT_HOME_HERO_CTA_LABEL,
        textColor: cms.textColor || DEFAULT_HOME_HERO_TEXT_COLOR,
        buttonBackgroundColor: cms.buttonBackgroundColor || DEFAULT_HOME_HERO_BUTTON_BG,
        buttonTextColor: cms.buttonTextColor || DEFAULT_HOME_HERO_BUTTON_TEXT_COLOR,
        ctaTarget: resolveHomeHeroCtaTarget(cms.buttonLink, pathname),
        fromCms: true,
      };
    }

    return {
      imageUri: homeNewInHeroImageUri(screenWidth),
      kicker: DEFAULT_HOME_HERO_KICKER,
      ctaLabel: DEFAULT_HOME_HERO_CTA_LABEL,
      textColor: DEFAULT_HOME_HERO_TEXT_COLOR,
      buttonBackgroundColor: DEFAULT_HOME_HERO_BUTTON_BG,
      buttonTextColor: DEFAULT_HOME_HERO_BUTTON_TEXT_COLOR,
      ctaTarget: resolveHomeHeroCtaTarget(undefined, pathname),
      fromCms: false,
    };
  }, [cms, fromCms, pathname, screenWidth]);

  return {
    ...content,
    loading: enabled && query.isPending,
  };
}
