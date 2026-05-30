import { LuxuryTabBodySpacer } from '@/components/navigation/luxury-tab-body-spacer';
import { Text } from '@/components/ui/text';
import { cn } from '@/utils/cn';

/** Editorial tab title — matches wishlist / bag / account. */
export const LUXURY_TAB_SCREEN_EYEBROW_CLASS =
  'mb-2.5 font-sans-md text-[10px] uppercase tracking-[0.18em] text-[rgba(110,94,79,0.82)]';

type LuxuryTabScreenHeaderProps = {
  title: string;
  className?: string;
};

export function LuxuryTabScreenHeader({ title, className }: LuxuryTabScreenHeaderProps) {
  return (
    <>
      <LuxuryTabBodySpacer />
      <Text className={cn('mb-5', LUXURY_TAB_SCREEN_EYEBROW_CLASS, className)}>{title}</Text>
    </>
  );
}
