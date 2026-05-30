import type { AccountOrder } from '@/types/account-order';

export function logAccountOrders(_scope: string, _payload: unknown): void {}

export function summarizeOrder(order: AccountOrder) {
  return {
    id: order.id,
    orderNumber: order.orderNumber,
    createdAt: order.createdAt,
    financialStatus: order.financialStatus,
    fulfillmentStatus: order.fulfillmentStatus,
    totalPrice: order.totalPrice,
    refundCount: order.refunds?.length ?? 0,
    lineItemCount: order.lineItems?.length ?? 0,
    statusPageUrl: order.statusPageUrl ? `${order.statusPageUrl.slice(0, 48)}…` : null,
    detailPath: order.actions?.detailPath ?? null,
  };
}

export function summarizeOrders(orders: AccountOrder[]) {
  return orders.map(summarizeOrder);
}
