import { Image } from 'expo-image';
import { useEffect } from 'react';

import { homeNewInHeroImageUri } from '@/constants/home-hero';

/** Warm disk cache for the home hero while catalog data loads. */
export function usePrefetchHomeHero(screenWidth: number) {
  useEffect(() => {
    const uri = homeNewInHeroImageUri(screenWidth);
    void Image.prefetch(uri);
  }, [screenWidth]);
}
