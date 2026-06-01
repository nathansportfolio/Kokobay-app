import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';

import { Text } from '@/components/ui/text';
import { cn } from '@/utils/cn';

type AccountSettingsRowProps = {
  label: string;
  value?: string;
  description?: string;
  onPress?: () => void;
  disabled?: boolean;
  showDivider?: boolean;
  trailing?: ReactNode;
  accessibilityLabel?: string;
};

export function AccountSettingsRow({
  label,
  value,
  description,
  onPress,
  disabled,
  showDivider,
  trailing,
  accessibilityLabel,
}: AccountSettingsRowProps) {
  const content = (
    <>
      <View className="min-w-0 flex-1 pr-3">
        <Text variant="body" className="text-ink">
          {label}
        </Text>
        {description ?
          <Text variant="caption" className="mt-1 text-mist">
            {description}
          </Text>
        : null}
      </View>
      {trailing ?
        <View className="shrink-0">{trailing}</View>
      : value ?
        <Text variant="body" className="shrink-0 text-right text-mist">
          {value}
        </Text>
      : null}
    </>
  );

  const rowClass = cn(
    'flex-row items-center justify-between px-4 py-3.5',
    showDivider && 'border-b border-line/35',
    disabled && 'opacity-50',
  );

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel ?? label}
        className={cn(rowClass, 'active:opacity-75')}>
        {content}
      </Pressable>
    );
  }

  return <View className={rowClass}>{content}</View>;
}
