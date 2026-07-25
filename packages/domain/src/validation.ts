export type UUID = string & { readonly __brand: 'UUID' }
export type Cents = number & { readonly __brand: 'Cents' }
export type PositiveCents = Cents & { readonly __brand: 'PositiveCents' }
export type CurrencyCode = string & { readonly __brand: 'CurrencyCode' }
export type TimeZone = string & { readonly __brand: 'TimeZone' }
export type Revision = number & { readonly __brand: 'Revision' }

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const currencyPattern = /^[A-Z]{3}$/
const isoDateTimePattern =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/

export function isUuid(value: unknown): value is UUID {
  return typeof value === 'string' && uuidPattern.test(value)
}

export function isCents(value: unknown): value is Cents {
  return typeof value === 'number' && Number.isSafeInteger(value)
}

export function isPositiveCents(value: unknown): value is PositiveCents {
  return isCents(value) && value > 0
}

export function isCurrencyCode(value: unknown): value is CurrencyCode {
  return typeof value === 'string' && currencyPattern.test(value)
}

export function isTimeZone(value: unknown): value is TimeZone {
  if (typeof value !== 'string' || value.length === 0) return false

  try {
    Intl.DateTimeFormat(undefined, { timeZone: value })
    return true
  } catch {
    return false
  }
}

export function isRevision(value: unknown): value is Revision {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 1
}

export function isIsoDateTime(value: unknown): value is string {
  if (typeof value !== 'string') return false

  const match = isoDateTimePattern.exec(value)
  if (!match) return false

  const [year, month, day, hour, minute, second] = match.slice(1, 7).map(Number)
  return (
    isCalendarDate(year, month, day) &&
    hour <= 23 &&
    minute <= 59 &&
    second <= 59 &&
    !Number.isNaN(Date.parse(value))
  )
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isCalendarDate(year: number, month: number, day: number): boolean {
  if (month < 1 || month > 12 || day < 1) return false

  const monthLengths = [
    31,
    isLeapYear(year) ? 29 : 28,
    31,
    30,
    31,
    30,
    31,
    31,
    30,
    31,
    30,
    31,
  ]
  return day <= monthLengths[month - 1]
}

function isLeapYear(year: number): boolean {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)
}
