/** Avoid cart ↔ auth store circular imports — registered once at app startup. */
let readCustomerEmail: (() => string | undefined) | null = null;
let readCustomerUserId: (() => string | undefined) | null = null;

export function registerCartCustomerEmailReader(fn: () => string | undefined): void {
  readCustomerEmail = fn;
}

export function registerCartCustomerUserIdReader(fn: () => string | undefined): void {
  readCustomerUserId = fn;
}

export function getCartCustomerEmail(): string | undefined {
  const email = readCustomerEmail?.()?.trim();
  return email || undefined;
}

export function getCartCustomerUserId(): string | undefined {
  const userId = readCustomerUserId?.()?.trim();
  return userId || undefined;
}
