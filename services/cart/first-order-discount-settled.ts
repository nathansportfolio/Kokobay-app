/** Session flag: avoid hammering discount API after success / permanent skip. No store imports. */
let discountApplySettled = false;

export function isFirstAppOrderDiscountApplySettled(): boolean {
  return discountApplySettled;
}

export function setFirstAppOrderDiscountApplySettled(value: boolean): void {
  discountApplySettled = value;
}

export function clearFirstAppOrderDiscountApplySettled(): void {
  discountApplySettled = false;
}
