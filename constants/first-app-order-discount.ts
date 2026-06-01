/** Auto-applied for logged-in customers who have never completed an app order. */
export const FIRST_APP_ORDER_DISCOUNT_CODE = '6Q1716ND2YMS';

export function isFirstAppOrderDiscountCode(code: string): boolean {
  return code.trim().toUpperCase() === FIRST_APP_ORDER_DISCOUNT_CODE.toUpperCase();
}

/** Cart totals label for the auto-applied first-app-order code. */
export function formatCartDiscountRowLabel(code: string): string {
  const parts = code
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
  const otherCodes = parts.filter((part) => !isFirstAppOrderDiscountCode(part));

  if (parts.some(isFirstAppOrderDiscountCode) && otherCodes.length === 0) {
    return 'First Order Discount';
  }
  if (parts.some(isFirstAppOrderDiscountCode)) {
    return `First Order Discount · ${otherCodes.join(', ')}`;
  }
  return `Discount · ${parts.join(', ')}`;
}
