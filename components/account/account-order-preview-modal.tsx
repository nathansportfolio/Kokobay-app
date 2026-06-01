import { ChevronRight, X } from 'lucide-react-native';
import { Linking, Modal, Pressable, ScrollView, View } from 'react-native';
import { useEffect } from 'react';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  ACCOUNT_SCREEN_GAP,
  AccountCard,
  AccountCardBody,
  AccountCardDivider,
  AccountSection,
} from '@/components/account/account-layout';
import { CatalogCoverImage } from '@/components/ui/catalog-cover-image';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { palette } from '@/constants/theme';
import type { AccountOrder, AccountOrderLineItem } from '@/types/account-order';
import { logAccountOrders, summarizeOrder } from '@/utils/account-order-debug';
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
import { hapticLight } from '@/utils/haptics';
import { formatCartMoney } from '@/utils/money';
import { cn } from '@/utils/cn';

const ORDER_MODAL_CANVAS = '#FAF8F5';
const H_PAD = 22;

type Props = {
  order: AccountOrder | null;
  visible: boolean;
  onClose: () => void;
};

function OrderDetailRow({
  label,
  value,
  valueClassName,
  showDivider,
}: {
  label: string;
  value: string;
  valueClassName?: string;
  showDivider?: boolean;
}) {
  return (
    <View
      className={cn(
        'flex-row items-center justify-between px-4 py-3.5',
        showDivider && 'border-b border-line/35',
      )}>
      <Text variant="body" className="text-mist">
        {label}
      </Text>
      <Text
        className={cn(
          'max-w-[58%] shrink-0 text-right font-sans-md text-[15px] text-ink',
          valueClassName,
        )}
        numberOfLines={2}>
        {value}
      </Text>
    </View>
  );
}

function LineItemRow({ item, showDivider }: { item: AccountOrderLineItem; showDivider?: boolean }) {
  const title = item.title?.trim() || 'Item';
  const variant = item.variantTitle?.trim();
  const qty = item.quantity ?? 1;
  const imageUrl = item.imageUrl?.trim();
  return (
    <View className={cn('flex-row gap-3.5 px-4 py-3.5', showDivider && 'border-b border-line/35')}>
      <View className="h-[92px] w-[68px] overflow-hidden rounded-2xl bg-warmElevated">
        {imageUrl ?
          <CatalogCoverImage
            uri={imageUrl}
            recyclingKey={`${title}-${variant ?? ''}`}
            priority="low"
            transition={240}
          />
        : null}
      </View>
      <View className="min-w-0 flex-1 justify-center">
        <Text
          className="font-sans-md text-[15px] leading-[21px] tracking-[-0.1px] text-ink"
          numberOfLines={2}>
          {title}
        </Text>
        {variant ?
          <Text variant="caption" className="mt-1 text-mist" numberOfLines={2}>
            {variant}
          </Text>
        : null}
        <Text variant="caption" className="mt-1.5 text-mist">
          Qty {qty}
        </Text>
        {item.unitPrice ?
          <Text className="mt-2 font-sans-md text-[15px] text-ink">
            {formatCartMoney(item.unitPrice)}
          </Text>
        : null}
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
    hapticLight();
    logAccountOrders('openUrl', { url, order: summarizeOrder(order) });
    Linking.openURL(url).catch((err) => {
      logAccountOrders('openUrl failed', { url, err });
    });
  };

  const handleClose = () => {
    hapticLight();
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={handleClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: ORDER_MODAL_CANVAS }} edges={['top', 'left', 'right']}>
        <View className="flex-row items-start justify-between border-b border-line/45 px-[22] py-4">
          <View className="min-w-0 flex-1 pr-4">
            <Text className="mb-2 font-sans-md text-[10px] uppercase tracking-[0.18em] text-[rgba(110,94,79,0.82)]">
              Order details
            </Text>
            <Text className="font-sans-md text-[22px] leading-7 tracking-[-0.35px] text-ink">
              {order.orderNumber}
            </Text>
            <Text variant="caption" className="mt-1.5 text-mist">
              {formatOrderConfirmedDate(order.createdAt)}
            </Text>
          </View>
          <Pressable
            onPress={handleClose}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Close order details"
            className="rounded-full border border-line/50 bg-surface p-2 active:opacity-75">
            <X size={18} color={palette.ink} strokeWidth={1.5} />
          </Pressable>
        </View>

        <View style={{ flex: 1 }}>
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{
              paddingHorizontal: H_PAD,
              paddingTop: 20,
              paddingBottom: Math.max(insets.bottom, 16) + 32,
            }}
            showsVerticalScrollIndicator={false}>
            <View style={{ gap: ACCOUNT_SCREEN_GAP }}>
            {hasRefund ?
              <AccountSection title="Refund">
                <AccountCard>
                  <AccountCardBody className="gap-2 py-4">
                    {totalRefunded ?
                      <Text className="font-sans-md text-[20px] tracking-[-0.2px] text-ink">
                        {formatCartMoney(totalRefunded)}
                      </Text>
                    : null}
                    <Text className="font-sans-md text-[15px] text-ink">{getRefundStatusLabel(order)}</Text>
                    <Text variant="body" className="text-mist">
                      {getRefundMessage(order)}
                    </Text>
                  </AccountCardBody>
                  {order.refunds?.length ?
                    <>
                      <AccountCardDivider />
                      <View className="px-4 py-3">
                        {order.refunds.map((refund, index) => (
                          <View
                            key={refund.id}
                            className={cn(
                              'flex-row items-center justify-between gap-3 py-2',
                              index < (order.refunds?.length ?? 0) - 1 && 'border-b border-line/35',
                            )}>
                            <Text variant="caption" className="text-mist">
                              {refund.createdAt ? formatOrderShortDate(refund.createdAt) : 'Refund'}
                            </Text>
                            <Text variant="caption" className="font-sans-md text-ink">
                              {formatCartMoney(refund.totalRefunded)}
                            </Text>
                          </View>
                        ))}
                      </View>
                    </>
                  : null}
                </AccountCard>
              </AccountSection>
            : null}

            <AccountSection title="Summary">
              <AccountCard>
                <OrderDetailRow label="Placed" value={formatOrderDate(order.createdAt)} showDivider />
                <OrderDetailRow label="Status" value={status} valueClassName="text-accent" showDivider />
                <OrderDetailRow
                  label={hasRefund ? 'Order total' : 'Total'}
                  value={formatCartMoney(hasRefund ? netTotal : order.totalPrice)}
                />
                {hasRefund ?
                  <View className="border-t border-line/35 px-4 pb-3.5 pt-0">
                    <Text variant="caption" className="pt-2 text-mist">
                      Originally {formatCartMoney(order.totalPrice)}
                    </Text>
                  </View>
                : null}
              </AccountCard>
            </AccountSection>

            <AccountSection title="Items">
              {items.length > 0 ?
                <AccountCard>
                  {items.map((item, index) => (
                    <LineItemRow
                      key={`${item.title ?? 'item'}-${item.variantTitle ?? ''}-${index}`}
                      item={item}
                      showDivider={index < items.length - 1}
                    />
                  ))}
                </AccountCard>
              : <AccountCard>
                  <AccountCardBody>
                    <Text variant="body" className="text-mist">
                      Item details are not available for this order.
                    </Text>
                  </AccountCardBody>
                </AccountCard>
              }
            </AccountSection>

            {tracking.length > 0 ?
              <AccountSection title="Tracking">
                <AccountCard>
                  {tracking.map((entry, index) => (
                    <View key={`${entry.company ?? 'carrier'}-${entry.number ?? entry.url}`}>
                      {index > 0 ?
                        <AccountCardDivider />
                      : null}
                      <View className="px-4 py-3.5">
                        {entry.company || entry.number ?
                          <Text variant="body" className="mb-3 text-ink">
                            {[entry.company, entry.number].filter(Boolean).join(' · ')}
                          </Text>
                        : null}
                        {entry.url ?
                          <Button
                            title="Track shipment"
                            variant="secondary"
                            onPress={() => openUrl(entry.url!)}
                          />
                        : null}
                      </View>
                    </View>
                  ))}
                </AccountCard>
              </AccountSection>
            : null}

            {statusPageUrl ?
              <Button
                title="View full order on web"
                variant="secondary"
                onPress={() => openUrl(statusPageUrl)}
              />
            : null}
            </View>
          </ScrollView>
        </View>
      </SafeAreaView>
    </Modal>
  );
}
