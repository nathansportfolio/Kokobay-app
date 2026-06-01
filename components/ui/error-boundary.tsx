import { Component, type ErrorInfo, type ReactNode } from 'react';
import { View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';

import { reportAppErrorFromUnknown } from '@/lib/appErrorLog';

export type AppErrorBoundaryProps = {
  children: ReactNode;
  /** Short label for logs and fallback copy (e.g. "Product gallery"). */
  name?: string;
  fallback?: ReactNode | ((args: { error: Error; retry: () => void }) => ReactNode);
  onError?: (error: Error, info: ErrorInfo) => void;
};

type State = { error: Error | null };

/**
 * Catches render errors in children so one bad component does not take down the screen.
 */
export class AppErrorBoundary extends Component<AppErrorBoundaryProps, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    const label = this.props.name ?? 'AppErrorBoundary';
    reportAppErrorFromUnknown(error, {
      context: {
        source: 'error_boundary',
        boundary: label,
        componentStack: info.componentStack?.slice(0, 4000) ?? null,
      },
    });
    this.props.onError?.(error, info);
  }

  private retry = (): void => {
    this.setState({ error: null });
  };

  render(): ReactNode {
    const { error } = this.state;
    if (!error) {
      return this.props.children;
    }

    const { fallback, name } = this.props;
    if (typeof fallback === 'function') {
      return fallback({ error, retry: this.retry });
    }
    if (fallback) {
      return fallback;
    }

    return (
      <View className="items-center justify-center bg-surface px-6 py-10">
        <Text variant="label" className="mb-2 text-mist">
          {name ? `${name} unavailable` : 'Something went wrong'}
        </Text>
        <Text variant="caption" className="mb-6 text-center text-mist">
          {__DEV__ ? error.message : 'Please try again.'}
        </Text>
        <Button title="Try again" variant="secondary" onPress={this.retry} />
      </View>
    );
  }
}
