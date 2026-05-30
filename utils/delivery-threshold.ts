import { DEFAULT_FREE_DELIVERY_THRESHOLD_GBP } from '@/constants/delivery-threshold';

/** Extract a positive GBP threshold from CMS `content` (e.g. `100`, `£100.00`). */
export function parseDeliveryThresholdFromContent(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const match = trimmed.match(/(\d+(?:\.\d+)?)/);
  if (!match) return null;

  const n = Number.parseFloat(match[1]);
  if (!Number.isFinite(n) || n <= 0) return null;

  return Math.round(n * 100) / 100;
}

export function resolveDeliveryThresholdGbp(content: string): number {
  return parseDeliveryThresholdFromContent(content) ?? DEFAULT_FREE_DELIVERY_THRESHOLD_GBP;
}
