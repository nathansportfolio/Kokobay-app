import type { ReactNode } from 'react';
import { View } from 'react-native';

import { Text } from '@/components/ui/text';

export type EmptyStateProps = {
  title: string;
  message: string;
  children?: ReactNode;
};

export function EmptyState({ title, message, children }: EmptyStateProps) {
  return (
    <View className="items-center justify-center px-5 py-20">
      <Text variant="label" className="mb-2.5 text-center">
        Koko Bay
      </Text>
      <Text variant="title" className="mb-3 text-center text-[21px] tracking-[-0.3px]">
        {title}
      </Text>
      <Text variant="body" className="mb-9 max-w-sm text-center text-[15px] leading-6 text-muted">
        {message}
      </Text>
      {children ? <View className="w-full max-w-xs gap-3.5">{children}</View> : null}
    </View>
  );
}
