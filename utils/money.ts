import type { Money } from '@/types/shopify';

type MoneyLike = Money & { currency?: string };

function resolveCurrencyCode(m: MoneyLike): string {
  return m.currencyCode?.trim() || m.currency?.trim() || 'GBP';
}

export function parseMoneyAmount(m: Money): number {
  const n = Number.parseFloat(m.amount);
  return Number.isNaN(n) ? 0 : n;
}

export function sumMoney(amounts: MoneyLike[]): Money | null {
  if (!amounts.length) return null;
  const currencyCode = resolveCurrencyCode(amounts[0]!);
  const total = amounts.reduce((acc, m) => acc + parseMoneyAmount(m), 0);
  return { amount: total.toFixed(2), currencyCode };
}

export function subtractMoney(a: Money, b: Money): Money {
  const next = parseMoneyAmount(a) - parseMoneyAmount(b);
  return { amount: Math.max(0, next).toFixed(2), currencyCode: a.currencyCode };
}

function localeForCurrency(currencyCode: string): string {
  switch (currencyCode) {
    case 'GBP':
      return 'en-GB';
    case 'EUR':
      return 'en-IE';
    default:
      return 'en-US';
  }
}

export function formatMoney(m: MoneyLike): string {
  const currencyCode = resolveCurrencyCode(m);
  const n = Number.parseFloat(m.amount);
  if (Number.isNaN(n)) {
    return `${currencyCode} ${m.amount}`;
  }
  try {
    return new Intl.NumberFormat(localeForCurrency(currencyCode), {
      style: 'currency',
      currency: currencyCode,
      maximumFractionDigits: 0,
    }).format(n);
  } catch {
    return `${currencyCode} ${m.amount}`;
  }
}

/** Bag / checkout — show pence so line subtotals sum to the footer (PLP keeps whole pounds via `formatMoney`). */
export function formatCartMoney(m: MoneyLike): string {
  const currencyCode = resolveCurrencyCode(m);
  const n = Number.parseFloat(m.amount);
  if (Number.isNaN(n)) {
    return `${currencyCode} ${m.amount}`;
  }
  try {
    return new Intl.NumberFormat(localeForCurrency(currencyCode), {
      style: 'currency',
      currency: currencyCode,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(n);
  } catch {
    return `${currencyCode} ${m.amount}`;
  }
}
