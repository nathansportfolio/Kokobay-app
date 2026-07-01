import { useEffect } from 'react';
import { usePathname } from 'expo-router';

import { LuxuryTabBodySpacer } from '@/components/navigation/luxury-tab-body-spacer';
import { Text } from '@/components/ui/text';
import { logPlpChromeSnap } from '@/lib/plp-chrome-snap-trace';
import { cn } from '@/utils/cn';

/** Editorial tab title — matches wishlist / bag / account. */
export const LUXURY_TAB_SCREEN_EYEBROW_CLASS =
  'mb-2.5 font-sans-md text-[10px] uppercase tracking-[0.18em] text-[rgba(110,94,79,0.82)]';

type LuxuryTabScreenHeaderProps = {
  title: string;
  className?: string;
};

export function LuxuryTabScreenHeader({ title, className }: LuxuryTabScreenHeaderProps) {
  const pathname = usePathname();

  useEffect(() => {
    logPlpChromeSnap('luxury_tab_screen_header_mount', { pathname, title });
    return () => {
      logPlpChromeSnap('luxury_tab_screen_header_unmount', { pathname, title });
    };
  }, [pathname, title]);

  return (
    <>
      <LuxuryTabBodySpacer />
      <Text className={cn('mb-5', LUXURY_TAB_SCREEN_EYEBROW_CLASS, className)}>{title}</Text>
    </>
  );
}
