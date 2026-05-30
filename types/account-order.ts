import type { Money } from '@/types/shopify';

export type AccountOrderLineItem = {
  title?: string;
  quantity?: number;
  variantTitle?: string | null;
  imageUrl?: string | null;
  unitPrice?: Money;
};

export type AccountOrderTracking = {
  url?: string | null;
  number?: string | null;
  company?: string | null;
};

export type AccountOrderRefund = {
  id: string;
  createdAt?: string;
  totalRefunded: Money;
};

export type AccountOrderAddress = {
  name?: string;
  address1?: string;
  address2?: string;
  city?: string;
  province?: string;
  zip?: string;
  country?: string;
  phone?: string;
};

export type AccountOrderPayment = {
  methodLabel?: string;
  amount?: Money;
  processedAt?: string;
};

export type AccountOrderActions = {
  canViewDetail?: boolean;
  canTrack?: boolean;
  canReturn?: boolean;
  canReorder?: boolean;
  detailPath?: string | null;
  returnPath?: string | null;
  reorderPath?: string | null;
};

export type AccountOrder = {
  id: string;
  orderNumber: string;
  createdAt: string;
  financialStatus?: string | null;
  fulfillmentStatus?: string | null;
  totalPrice: Money;
  lineItems?: AccountOrderLineItem[];
  tracking?: AccountOrderTracking[];
  statusPageUrl?: string | null;
  refunds?: AccountOrderRefund[];
  email?: string | null;
  shippingAddress?: AccountOrderAddress | null;
  billingAddress?: AccountOrderAddress | null;
  shippingMethod?: string | null;
  payment?: AccountOrderPayment | null;
  actions?: AccountOrderActions;
};

export type AccountOrdersPagination = {
  first: number;
  hasNextPage: boolean;
  endCursor: string | null;
};

export type AccountOrdersResult =
  | { ok: true; orders: AccountOrder[]; pagination: AccountOrdersPagination }
  | { ok: false; error: string; code?: string; unauthorized?: boolean };
