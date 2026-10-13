/**
 * Money conventions used across DailyOS:
 *
 * - Amounts are stored and summed as whole **paise** (integers), never as fractional rupees,
 *   so totals never drift from floating-point rounding.
 * - They are shown in Indian rupees with Indian digit grouping (₹12,34,567) via `en-IN`.
 */

export const PAISE_PER_RUPEE = 100;

/** Largest amount accepted anywhere: ₹1,000 crore. Keeps sums far inside safe integers. */
export const MAX_PAISE = 10_000_000_000 * PAISE_PER_RUPEE;

const whole = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
});
const exact = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const compact = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  notation: 'compact',
  maximumFractionDigits: 1,
});

export interface FormatMoneyOptions {
  /** Short form for tight spaces: ₹1.2L, ₹3.4Cr. */
  compact?: boolean;
  /** Prefix positive values with "+" (negative values always show "−"). */
  signed?: boolean;
}

/** Formats paise as rupees. Paise are shown only when the amount isn't whole rupees. */
export function formatINR(paise: number, options: FormatMoneyOptions = {}): string {
  const rupees = paise / PAISE_PER_RUPEE;
  const formatter = options.compact ? compact : Number.isInteger(rupees) ? whole : exact;
  // Intl uses an ASCII hyphen; a real minus sign reads better beside digits.
  const text = formatter.format(Math.abs(rupees));
  if (paise < 0) return `−${text}`;
  if (options.signed && paise > 0) return `+${text}`;
  return text;
}

/**
 * Parses what someone typed as a rupee amount ("1,23,456.50", "₹ 2000") into paise.
 * Returns undefined for anything that isn't a plain non-negative amount with at most two
 * decimal places.
 */
export function parseRupees(text: string): number | undefined {
  const cleaned = text.replace(/[₹,\s]/g, '');
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return undefined;
  const [rupees = '0', fraction = ''] = cleaned.split('.');
  const paise = Number(rupees) * PAISE_PER_RUPEE + Number(fraction.padEnd(2, '0'));
  return Number.isSafeInteger(paise) ? paise : undefined;
}

/** Paise as an editable rupee string without grouping, e.g. 1234550 → "12345.5". */
export function toRupeeInput(paise: number): string {
  return String(paise / PAISE_PER_RUPEE);
}

/** Share of `part` in `whole`, or null when there's nothing to compare against. */
export function ratio(part: number, whole: number): number | null {
  return whole === 0 ? null : part / whole;
}
