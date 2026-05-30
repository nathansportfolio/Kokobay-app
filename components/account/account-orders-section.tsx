import { useInfiniteQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';

import { AccountOrderPreviewModal } from '@/components/account/account-order-preview-modal';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { fetchAccountOrders } from '@/services/kokobay-web/account-orders';
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
  sessionToken: string | null | undefined;
  /** Deep link from push notification (`orderId` route param). */
  openOrderId?: string;
  openOrderNumber?: string;
  onRequestSignIn?: () => void;
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
      className="border-b border-line/60 py-4 active:opacity-85 last:border-b-0"
      accessibilityRole="button"
      accessibilityLabel={`View order ${order.orderNumber}`}>
      <View className="flex-row items-start justify-between gap-3">
        <View className="min-w-0 flex-1">
          <Text className="font-sans-md text-[15px] text-ink">{order.orderNumber}</Text>
          <Text variant="caption" className="mt-1 text-mist">
            {formatOrderDate(order.createdAt)}
          </Text>
          {summary ? (
            <Text variant="caption" className="mt-2 text-mist" numberOfLines={2}>
              {summary}
            </Text>
          ) : null}
        </View>
        <View className="items-end">
          <Text className="font-sans-md text-[15px] text-ink">
            {formatCartMoney(displayTotal)}
          </Text>
          <Text variant="caption" className="mt-1 text-accent">
            {status}
          </Text>
        </View>
      </View>
      <Text variant="caption" className="mt-3 text-mist underline">
        View details
      </Text>
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

export function AccountOrdersSection({
  sessionToken,
  openOrderId,
  openOrderNumber,
  onRequestSignIn,
}: Props) {
  const enabled = Boolean(sessionToken?.trim());
  const [previewOrder, setPreviewOrder] = useState<AccountOrder | null>(null);

  const {
    data,
    isPending,
    isError,
    error,
    isRefetching,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ['account', 'orders', sessionToken],
    enabled,
    initialPageParam: undefined as string | undefined,
    staleTime: 60_000,
    queryFn: async ({ pageParam }) => {
      const result = await fetchAccountOrders({
        first: PAGE_SIZE,
        after: pageParam,
        sessionToken: sessionToken ?? undefined,
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

  if (isPending) {
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
    return (
      <Text variant="body" className="text-mist">
        No orders yet. When you checkout, your purchases will appear here.
      </Text>
    );
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
