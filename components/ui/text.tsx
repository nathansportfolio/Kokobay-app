import { Text as RNText, TextProps as RNTextProps } from 'react-native';

import { cn } from '@/utils/cn';

export type TextVariant = 'display' | 'title' | 'body' | 'caption' | 'label';

const variantClass: Record<TextVariant, string> = {
  display: 'font-sans-semibold text-[28px] leading-8 tracking-[-0.4px] text-ink',
  title: 'font-sans-semibold text-[20px] leading-7 tracking-[-0.25px] text-ink',
  body: 'font-sans text-[15px] leading-6 text-mist',
  caption: 'font-sans text-[13px] leading-5 text-muted',
  label: 'font-sans-md text-[11px] uppercase tracking-[0.16em] text-mist',
};

export type AppTextProps = Omit<RNTextProps, 'role'> & {
  variant?: TextVariant;
  className?: string;
};

export function Text({ variant = 'body', className, ...props }: AppTextProps) {
  return <RNText className={cn(variantClass[variant], className)} {...props} />;
}
