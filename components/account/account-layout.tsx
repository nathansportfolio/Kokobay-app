import type { ReactNode } from 'react';
import { View } from 'react-native';

import { Text } from '@/components/ui/text';
import { cn } from '@/utils/cn';

/** Vertical rhythm between account screen sections — matches home/cart px-5 spacing. */
export const ACCOUNT_SCREEN_GAP = 24;

type AccountSectionProps = {
  title: string;
  children: ReactNode;
  className?: string;
};

export function AccountSection({ title, children, className }: AccountSectionProps) {
  return (
    <View className={cn(className)}>
      <Text variant="label" className="mb-3 tracking-[0.14em] text-mist">
        {title}
      </Text>
      {children}
    </View>
  );
}

type AccountCardProps = {
  children: ReactNode;
  className?: string;
};

/** Surface card — aligned with cart rows and market settings elsewhere in the app. */
export function AccountCard({ children, className }: AccountCardProps) {
  return (
    <View className={cn('overflow-hidden rounded-2xl border border-line/45 bg-surface', className)}>
      {children}
    </View>
  );
}

type AccountCardBodyProps = {
  children: ReactNode;
  className?: string;
};

export function AccountCardBody({ children, className }: AccountCardBodyProps) {
  return <View className={cn('px-4 py-4', className)}>{children}</View>;
}

export function AccountCardDivider() {
  return <View className="h-px bg-line/40" />;
}
