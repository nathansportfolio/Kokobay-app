import type {
  AccountOrder,
  AccountOrderAddress,
  AccountOrderRefund,
} from '@/types/account-order';
import type { Money } from '@/types/shopify';

import { parseMoneyAmount, subtractMoney, sumMoney } from '@/utils/money';

const STATUS_LABELS: Record<string, string> = {
  FULFILLED: 'Delivered',
  IN_TRANSIT: 'On the way',
  PARTIALLY_FULFILLED: 'Partially shipped',
  UNFULFILLED: 'Preparing',
  PAID: 'Confirmed',
  PARTIALLY_PAID: 'Partially paid',
  PENDING: 'Processing',
  AUTHORIZED: 'Processing',
  REFUNDED: 'Refunded',
  PARTIALLY_REFUNDED: 'Partially refunded',
  VOIDED: 'Cancelled',
};

const REFUND_FINANCIAL_STATUSES = new Set(['REFUNDED', 'PARTIALLY_REFUNDED']);

export function formatOrderStatusLabel(order: AccountOrder): string {
  const fulfillment = order.fulfillmentStatus?.trim().toUpperCase();
  const financial = order.financialStatus?.trim().toUpperCase();

  if (financial && REFUND_FINANCIAL_STATUSES.has(financial) && STATUS_LABELS[financial]) {
    return STATUS_LABELS[financial];
  }
  if (fulfillment && STATUS_LABELS[fulfillment]) {
    return STATUS_LABELS[fulfillment];
  }
  if (financial && STATUS_LABELS[financial]) {
    return STATUS_LABELS[financial];
  }
  return order.fulfillmentStatus || order.financialStatus || 'Processing';
}

export function formatOrderDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date);
}

/** Shopify-style: "Confirmed 26 May" */
export function formatOrderConfirmedDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'Confirmed';
  const dayMonth = new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
  }).format(date);
  return `Confirmed ${dayMonth}`;
}

export function formatOrderShortDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
  }).format(date);
}

export function sumOrderRefunds(refunds: AccountOrderRefund[] | undefined): Money | null {
  if (!refunds?.length) return null;
  return sumMoney(refunds.map((refund) => refund.totalRefunded));
}

export function isFullyRefunded(order: AccountOrder): boolean {
  const financial = order.financialStatus?.trim().toUpperCase();
  if (financial === 'REFUNDED') return true;

  const refunded = sumOrderRefunds(order.refunds);
  if (!refunded) return false;

  const orderTotal = parseMoneyAmount(order.totalPrice);
  const refundedTotal = parseMoneyAmount(refunded);
  return refundedTotal >= orderTotal - 0.005;
}

export function orderHasRefund(order: AccountOrder): boolean {
  const financial = order.financialStatus?.trim().toUpperCase();
  if (financial && REFUND_FINANCIAL_STATUSES.has(financial)) return true;
  return Boolean(order.refunds?.length);
}

export function orderHasFullDetails(order: AccountOrder): boolean {
  return Boolean(
    order.shippingAddress &&
      order.billingAddress &&
      (order.payment || order.shippingMethod),
  );
}

export function getOrderNetTotal(order: AccountOrder): Money {
  const refunded = sumOrderRefunds(order.refunds);
  if (!refunded) return order.totalPrice;
  return subtractMoney(order.totalPrice, refunded);
}

export function getRefundStatusLabel(order: AccountOrder): string {
  if (isFullyRefunded(order)) return 'Refunded';
  return 'Partially refunded';
}

export function getRefundMessage(order: AccountOrder): string {
  if (isFullyRefunded(order)) {
    return 'You received a full refund for this order.';
  }
  const refunded = sumOrderRefunds(order.refunds);
  if (refunded) {
    return 'You received a partial refund for this order.';
  }
  return 'This order has been refunded.';
}

export function formatAddressLines(address: AccountOrderAddress): string[] {
  const lines: string[] = [];
  if (address.name?.trim()) lines.push(address.name.trim());
  if (address.address1?.trim()) lines.push(address.address1.trim());
  if (address.address2?.trim()) lines.push(address.address2.trim());

  const cityLine = [address.city?.trim(), address.zip?.trim()].filter(Boolean).join(', ');
  if (cityLine) lines.push(cityLine);
  if (address.province?.trim() && address.province.trim() !== cityLine) {
    lines.push(address.province.trim());
  }
  if (address.country?.trim()) lines.push(address.country.trim());
  if (address.phone?.trim()) lines.push(address.phone.trim());
  return lines;
}

export function orderLineItemSummary(order: AccountOrder): string | undefined {
  const items = order.lineItems ?? [];
  if (!items.length) return undefined;
  const first = items[0]?.title?.trim();
  if (!first) return undefined;
  if (items.length === 1) return first;
  return `${first} + ${items.length - 1} more`;
}

export function firstTrackingUrl(order: AccountOrder): string | undefined {
  const entry = orderTrackingEntries(order)[0];
  return entry?.url;
}

/** Carrier tracking only — excludes Shopify status/checkout URLs. */
export function orderTrackingEntries(order: AccountOrder): Array<{
  url?: string;
  number?: string | null;
  company?: string | null;
}> {
  return (order.tracking ?? [])
    .map((t) => ({
      url: t.url?.trim() || undefined,
      number: t.number,
      company: t.company,
    }))
    .filter((t) => {
      if (!t.url) return Boolean(t.number || t.company);
      const lower = t.url.toLowerCase();
      return !lower.includes('shopify.com') && !lower.includes('myshopify.com');
    });
}
