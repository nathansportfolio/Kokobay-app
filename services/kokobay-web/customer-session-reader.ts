/** Avoid auth ↔ session circular imports — registered once at app startup. */
let readSessionToken: (() => string | undefined) | null = null;

export function registerCustomerSessionReader(fn: () => string | undefined): void {
  readSessionToken = fn;
}

export function getInMemoryCustomerSessionToken(): string | undefined {
  const token = readSessionToken?.()?.trim();
  return token || undefined;
}
