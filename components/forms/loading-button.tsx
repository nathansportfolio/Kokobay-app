import { forwardRef, type ElementRef } from 'react';

import { Button, type ButtonProps } from '@/components/ui/button';

export type LoadingButtonProps = ButtonProps & {
  loadingTitle: string;
};

export const LoadingButton = forwardRef<ElementRef<typeof Button>, LoadingButtonProps>(
  ({ title, loadingTitle, loading = false, disabled, ...rest }, ref) => (
    <Button
      ref={ref}
      title={loading ? loadingTitle : title}
      loading={loading}
      disabled={disabled || loading}
      {...rest}
    />
  ),
);

LoadingButton.displayName = 'LoadingButton';
