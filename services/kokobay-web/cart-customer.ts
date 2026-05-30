/** Avoid cart ↔ auth store circular imports — registered once at app startup. */
let readCustomerEmail: (() => string | undefined) | null = null;

export function registerCartCustomerEmailReader(fn: () => string | undefined): void {
  readCustomerEmail = fn;
}

export function getCartCustomerEmail(): string | undefined {
  const email = readCustomerEmail?.()?.trim();
  return email || undefined;
}
