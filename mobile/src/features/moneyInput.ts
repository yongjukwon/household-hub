/**
 * Money-entry helpers shared by Groceries, Ledger, and Trips. All amounts are
 * stored as integer cents; these bridge a decimal text field to that.
 */

/**
 * Parses a user-typed amount (dollars, optional decimals, optional symbols and
 * thousands separators) into integer cents. Returns null for empty or invalid
 * input, so callers can distinguish "no price" from "0".
 */
export function parseDollarsToCents(input: string): number | null {
  const cleaned = input.replace(/[^0-9.]/g, '')
  if (cleaned === '' || cleaned === '.') return null
  const value = Number(cleaned)
  if (!Number.isFinite(value) || value < 0) return null
  return Math.round(value * 100)
}

/** Formats integer cents as a plain decimal for an editable input, e.g. "12.50". */
export function centsToInputValue(cents: number | null | undefined): string {
  if (cents === null || cents === undefined) return ''
  return (cents / 100).toFixed(2)
}
