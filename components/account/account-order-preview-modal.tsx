import { Linking, Modal, Pressable, ScrollView, View } from 'react-native';
import { useEffect } from 'react';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { formatCartMoney } from '@/utils/money';
import { logAccountOrders, summarizeOrder } from '@/utils/account-order-debug';
import { CatalogCoverImage } from '@/components/ui/catalog-cover-image';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { palette } from '@/constants/theme';
import type { AccountOrder, AccountOrderLineItem } from '@/types/account-order';
import {
  formatOrderConfirmedDate,
  formatOrderDate,
  formatOrderShortDate,
  formatOrderStatusLabel,
  getOrderNetTotal,
  getRefundMessage,
  getRefundStatusLabel,
  orderHasRefund,
  orderTrackingEntries,
  sumOrderRefunds,
} from '@/utils/account-order-display';

type Props = {
  order: AccountOrder | null;
  visible: boolean;
  onClose: () => void;
};

function LineItemRow({ item }: { item: AccountOrderLineItem }) {
  const title = item.title?.trim() || 'Item';
  const variant = item.variantTitle?.trim();
  const qty = item.quantity ?? 1;
  const imageUrl = item.imageUrl?.trim();

  return (
    <View className="mb-4 flex-row gap-3">
      <View className="relative h-[88px] w-[64px] overflow-hidden rounded-sm bg-elevated">
        {imageUrl ? (
          <CatalogCoverImage uri={imageUrl} recyclingKey={`${title}-${variant ?? ''}`} priority="low" />
        ) : null}
      </View>
      <View className="min-w-0 flex-1 justify-center">
        <Text className="font-sans-md text-[15px] leading-5 text-ink" numberOfLines={2}>
          {title}
        </Text>
        {variant ? (
          <Text variant="caption" className="mt-1 text-mist" numberOfLines={2}>
            {variant}
          </Text>
        ) : null}
        <Text variant="caption" className="mt-1.5 text-mist">
          Qty {qty}
        </Text>
        {item.unitPrice ? (
          <Text variant="caption" className="mt-1 text-ink">
            {formatCartMoney(item.unitPrice)}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

export function AccountOrderPreviewModal({ order, visible, onClose }: Props) {
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (!visible || !order) return;
    logAccountOrders('preview modal render', {
      visible,
      order: summarizeOrder(order),
      lineItems: order.lineItems?.map((item) => ({
        title: item.title,
        variantTitle: item.variantTitle,
        quantity: item.quantity,
      })),
      refunds: order.refunds?.map((refund) => ({
        id: refund.id,
        totalRefunded: refund.totalRefunded,
        createdAt: refund.createdAt,
      })),
      statusPageUrl: order.statusPageUrl,
    });
  }, [visible, order]);

  if (!order) return null;

  const status = formatOrderStatusLabel(order);
  const tracking = orderTrackingEntries(order);
  const items = order.lineItems ?? [];
  const hasRefund = orderHasRefund(order);
  const totalRefunded = sumOrderRefunds(order.refunds);
  const netTotal = getOrderNetTotal(order);
  const statusPageUrl = order.statusPageUrl?.trim();

  const openUrl = (url: string) => {
    logAccountOrders('openUrl', { url, order: summarizeOrder(order) });
    Linking.openURL(url).catch((err) => {
      logAccountOrders('openUrl failed', { url, err });
    });
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: palette.canvas }} edges={['top', 'left', 'right']}>
        <View className="flex-row items-center justify-between border-b border-line px-5 py-4">
          <View className="min-w-0 flex-1 pr-4">
            <Text variant="label" className="mb-1 text-accent">
              Order
            </Text>
            <Text variant="title" className="text-[20px]">
              {order.orderNumber}
            </Text>
            <Text variant="caption" className="mt-1 text-mist">
              {formatOrderConfirmedDate(order.createdAt)}
            </Text>
          </View>
          <Pressable
            onPress={onClose}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Close order preview">
            <Text className="font-sans-md text-[15px] text-ink">Close</Text>
          </Pressable>
        </View>

        <View style={{ flex: 1 }}>
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{
            paddingHorizontal: 20,
            paddingTop: 20,
            paddingBottom: Math.max(insets.bottom, 16) + 24,
          }}
          showsVerticalScrollIndicator={false}>
          {hasRefund ? (
            <View className="mb-6 border border-line bg-surface px-4 py-4">
              {totalRefunded ? (
                <Text className="font-sans-md text-[18px] text-ink">
                  {formatCartMoney(totalRefunded)}
                </Text>
              ) : null}
              <Text className="mt-1 font-sans-md text-[15px] text-ink">
                {getRefundStatusLabel(order)}
              </Text>
              <Text variant="body" className="mt-2 text-mist">
                {getRefundMessage(order)}
              </Text>
              {order.refunds?.length ? (
                <View className="mt-4 border-t border-line/60 pt-4">
                  {order.refunds.map((refund) => (
                    <View
                      key={refund.id}
                      className="mb-2 flex-row items-center justify-between gap-3 last:mb-0">
                      <Text variant="caption" className="text-mist">
                        {refund.createdAt ? formatOrderShortDate(refund.createdAt) : 'Refund'}
                      </Text>
                      <Text variant="caption" className="text-ink">
                        {formatCartMoney(refund.totalRefunded)}
                      </Text>
                    </View>
                  ))}
                </View>
              ) : null}
            </View>
          ) : null}

          <View className="mb-6 border border-line bg-surface px-4 py-4">
            <View className="flex-row items-start justify-between gap-3">
              <View>
                <Text variant="label" className="mb-1 text-mist">
                  Placed
                </Text>
                <Text variant="body" className="text-ink">
                  {formatOrderDate(order.createdAt)}
                </Text>
              </View>
              <View className="items-end">
                <Text variant="label" className="mb-1 text-mist">
                  Status
                </Text>
                <Text variant="body" className="text-accent">
                  {status}
                </Text>
              </View>
            </View>
            <View className="mt-4 border-t border-line/60 pt-4">
              <Text variant="label" className="mb-1 text-mist">
                {hasRefund ? 'Order total' : 'Total'}
              </Text>
              <Text className="font-sans-md text-[18px] text-ink">
                {formatCartMoney(hasRefund ? netTotal : order.totalPrice)}
              </Text>
              {hasRefund ? (
                <Text variant="caption" className="mt-1 text-mist">
                  Originally {formatCartMoney(order.totalPrice)}
                </Text>
              ) : null}
            </View>
          </View>

          <Text variant="label" className="mb-3 text-mist">
            Items
          </Text>
          {items.length > 0 ? (
            items.map((item, index) => (
              <LineItemRow key={`${item.title ?? 'item'}-${item.variantTitle ?? ''}-${index}`} item={item} />
            ))
          ) : (
            <Text variant="body" className="mb-6 text-mist">
              Item details are not available for this order.
            </Text>
          )}

          {statusPageUrl ? (
            <View className="mt-6 border-t border-line/60 pt-6">
              <Button
                title="View full order details"
                variant="secondary"
                onPress={() => openUrl(statusPageUrl)}
              />
            </View>
          ) : null}

          {tracking.length > 0 ? (
            <View className="mt-6 border-t border-line/60 pt-6">
              <Text variant="label" className="mb-3 text-mist">
                Tracking
              </Text>
              {tracking.map((entry) => (
                <View key={`${entry.company ?? 'carrier'}-${entry.number ?? entry.url}`} className="mb-3">
                  {entry.company || entry.number ? (
                    <Text variant="body" className="mb-2 text-ink">
                      {[entry.company, entry.number].filter(Boolean).join(' · ')}
                    </Text>
                  ) : null}
                  {entry.url ? (
                    <Button
                      title="Track shipment"
                      variant="secondary"
                      onPress={() => openUrl(entry.url!)}
                    />
                  ) : null}
                </View>
              ))}
            </View>
          ) : null}
        </ScrollView>
        </View>
      </SafeAreaView>
    </Modal>
  );
}
