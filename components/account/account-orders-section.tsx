import { useInfiniteQuery } from '@tanstack/react-query';
import { Link } from 'expo-router';
import { ChevronRight } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';

import { AccountOrderPreviewModal } from '@/components/account/account-order-preview-modal';
import { Button } from '@/components/ui/button';
import { palette } from '@/constants/theme';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { getAuthAccessToken } from '@/src/core/auth/token';
import { isAuthenticatedStatus } from '@/src/core/auth/types';
import { accountQueryKeys } from '@/src/core/query/query-keys';
import { fetchAccountOrders } from '@/services/kokobay-web/account-orders';
import { useAuthStore } from '@/store/auth-session';
import type { AccountOrder, AccountOrdersResult } from '@/types/account-order';
import {
  formatOrderDate,
  formatOrderStatusLabel,
  getOrderNetTotal,
  orderHasRefund,
  orderLineItemSummary,
} from '@/utils/account-order-display';
import { formatCartMoney } from '@/utils/money';
import { hapticLight } from '@/utils/haptics';
import { logAccountOrders, summarizeOrder, summarizeOrders } from '@/utils/account-order-debug';

const PAGE_SIZE = 20;

type Props = {
  /** Shopify customer id — keeps React Query cache scoped per account. */
  customerId?: string | null;
  /** Deep link from push notification (`orderId` route param). */
  openOrderId?: string;
  openOrderNumber?: string;
  onRequestSignIn?: () => void;
  /** When true, empty state uses compact in-card layout. */
  embedded?: boolean;
};

type OrderRowProps = {
  order: AccountOrder;
  onPress: () => void;
};

function OrderRow({ order, onPress }: OrderRowProps) {
  const status = formatOrderStatusLabel(order);
  const summary = orderLineItemSummary(order);
  const displayTotal = orderHasRefund(order) ? getOrderNetTotal(order) : order.totalPrice;

  return (
    <Pressable
      onPress={() => {
        hapticLight();
        logAccountOrders('OrderRow pressed', summarizeOrder(order));
        onPress();
      }}
      className="flex-row items-center border-b border-line/35 py-3.5 active:opacity-78 last:border-b-0"
      accessibilityRole="button"
      accessibilityLabel={`View order ${order.orderNumber}`}>
      <View className="min-w-0 flex-1 pr-3">
        <Text className="font-sans-md text-[15px] leading-5 text-ink">{order.orderNumber}</Text>
        <Text variant="caption" className="mt-1 text-mist">
          {formatOrderDate(order.createdAt)}
        </Text>
        {summary ?
          <Text variant="caption" className="mt-1.5 text-mist/90" numberOfLines={2}>
            {summary}
          </Text>
        : null}
        <Text variant="caption" className="mt-1.5 text-accent">
          {status}
        </Text>
      </View>
      <View className="items-end gap-2">
        <Text className="font-sans-md text-[15px] text-ink">{formatCartMoney(displayTotal)}</Text>
        <ChevronRight size={18} color={palette.mist} strokeWidth={1.5} />
      </View>
    </Pressable>
  );
}

function OrdersSkeleton() {
  return (
    <View className="gap-4 py-1">
      <Skeleton className="h-16 w-full" />
      <Skeleton className="h-16 w-full" />
    </View>
  );
}

function isOrdersError(error: unknown): error is Extract<AccountOrdersResult, { ok: false }> {
  return typeof error === 'object' && error !== null && 'ok' in error && (error as { ok: boolean }).ok === false;
}

function OrdersEmptyState({ embedded }: { embedded?: boolean }) {
  const shopCta = (
    <Link href="/" asChild>
      <Button title="Start shopping" variant="secondary" />
    </Link>
  );

  if (embedded) {
    return (
      <View className="items-center gap-4 py-6">
        <Text variant="label" className="tracking-[0.12em] text-mist">
          No orders yet
        </Text>
        <Text variant="body" className="text-center text-mist">
          Your purchases will appear here after checkout.
        </Text>
        {shopCta}
      </View>
    );
  }

  return (
    <EmptyState
      title="No orders yet"
      message="When you checkout, your purchases will appear here.">
      {shopCta}
    </EmptyState>
  );
}

export function AccountOrdersSection({
  customerId,
  openOrderId,
  openOrderNumber,
  onRequestSignIn,
  embedded,
}: Props) {
  const storeUserId = useAuthStore((s) => s.user?.id);
  const accessToken = useAuthStore((s) => s.accessToken);
  const status = useAuthStore((s) => s.status);
  const safeCustomerId = (customerId ?? storeUserId)?.trim() ?? '';
  const enabled = Boolean(
    safeCustomerId && accessToken?.trim() && isAuthenticatedStatus(status),
  );
  const [previewOrder, setPreviewOrder] = useState<AccountOrder | null>(null);

  useEffect(() => {
    setPreviewOrder(null);
  }, [safeCustomerId, accessToken]);

  const {
    data,
    isLoading,
    isFetching,
    isError,
    error,
    isRefetching,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: accountQueryKeys.orders(safeCustomerId),
    enabled,
    initialPageParam: undefined as string | undefined,
    staleTime: 60_000,
    queryFn: async ({ pageParam }) => {
      const sessionToken = getAuthAccessToken();
      if (!sessionToken) {
        throw { ok: false as const, error: 'Sign in to view orders.', code: 'unauthorized' };
      }
      const result = await fetchAccountOrders({
        first: PAGE_SIZE,
        after: pageParam,
        sessionToken,
      });
      if (!result.ok) {
        throw result;
      }
      return result;
    },
    getNextPageParam: (last) =>
      last.pagination.hasNextPage ? last.pagination.endCursor ?? undefined : undefined,
  });

  const orders = useMemo(
    () => data?.pages.flatMap((page) => page.orders) ?? [],
    [data],
  );

  // Recover when login teardown cancels an in-flight fetch before cache settles.
  useEffect(() => {
    if (!enabled || data !== undefined || isFetching || isError) return;
    void refetch();
  }, [data, enabled, isError, isFetching, refetch]);

  useEffect(() => {
    logAccountOrders('orders list updated', {
      count: orders.length,
      orders: summarizeOrders(orders),
      pageCount: data?.pages.length ?? 0,
    });
  }, [orders, data?.pages.length]);

  useEffect(() => {
    if (!previewOrder) {
      logAccountOrders('preview closed', null);
      return;
    }
    logAccountOrders('preview opened', summarizeOrder(previewOrder));
  }, [previewOrder]);

  useEffect(() => {
    if (!orders.length) return;
    const id = openOrderId?.trim();
    const number = openOrderNumber?.trim();
    if (!id && !number) return;

    const match = orders.find((o) => {
      if (id && o.id === id) return true;
      if (number && o.orderNumber === number) return true;
      return false;
    });
    if (match) {
      setPreviewOrder(match);
    }
  }, [orders, openOrderId, openOrderNumber]);

  if (!enabled) {
    return (
      <Text variant="body" className="text-mist">
        Sign in to view your orders.
      </Text>
    );
  }

  if (!data && (isLoading || isFetching)) {
    return <OrdersSkeleton />;
  }

  if (isError && isOrdersError(error)) {
    if (error.unauthorized || error.code === 'unauthorized') {
      return (
        <View>
          <Text variant="body" className="mb-4 text-mist">
            {error.error || 'Sign in to view your orders.'}
          </Text>
          <Button title="Sign in" variant="secondary" onPress={onRequestSignIn} />
        </View>
      );
    }
    return (
      <View>
        <Text variant="body" className="mb-4 text-mist">
          {error.error ?? 'Could not load order history.'}
        </Text>
        <Button
          title={isRefetching ? 'Retrying…' : 'Retry'}
          variant="secondary"
          loading={isRefetching}
          disabled={isRefetching}
          onPress={() => refetch()}
        />
      </View>
    );
  }

  if (isError) {
    return (
      <View>
        <Text variant="body" className="mb-4 text-mist">
          Could not load order history.
        </Text>
        <Button title="Retry" variant="secondary" onPress={() => refetch()} />
      </View>
    );
  }

  if (!orders.length) {
    return <OrdersEmptyState embedded={embedded} />;
  }

  return (
    <>
      <View>
        {orders.map((order) => (
          <OrderRow
            key={order.id}
            order={order}
            onPress={() => {
              logAccountOrders('setPreviewOrder', {
                from: summarizeOrder(order),
              });
              setPreviewOrder(order);
            }}
          />
        ))}
        {hasNextPage ? (
          <View className="mt-4 items-center">
            <Button
              title={isFetchingNextPage ? 'Loading…' : 'Load more orders'}
              variant="ghost"
              loading={isFetchingNextPage}
              disabled={isFetchingNextPage}
              onPress={() => fetchNextPage()}
            />
          </View>
        ) : null}
      </View>
      <AccountOrderPreviewModal
        order={previewOrder}
        visible={previewOrder !== null}
        onClose={() => setPreviewOrder(null)}
      />
    </>
  );
}

export const ACCOUNT_ORDERS_QUERY_KEY = ['account', 'orders'] as const;
