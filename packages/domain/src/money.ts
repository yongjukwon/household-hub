import type { Cents, CurrencyCode } from './validation'

/** Formats stored integer cents; it never performs currency conversion. */
export function formatMoney(
  cents: Cents | number,
  currency: CurrencyCode | string,
  locale = 'en-CA',
): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    currencyDisplay: 'narrowSymbol',
  }).format(cents / 100)
}
