/**
 * Date conventions used across DailyOS:
 *
 * - A *date key* is a local calendar date formatted as `YYYY-MM-DD`. It identifies a day
 *   (a plan, a habit entry, a review period) and carries no time or offset.
 * - A *timestamp* is an ISO-8601 instant (`Date#toISOString()`), used for events.
 *
 * A date key is always derived from an instant plus an explicit IANA time zone, never from
 * the instant alone, so "today" matches the user's wall calendar. Calendar arithmetic
 * operates on date keys rather than adding multiples of 24 hours, because local days are
 * 23 or 25 hours long across DST transitions.
 */

const DATE_KEY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

export function getDeviceTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

/** Returns the calendar date of `instant` as observed in `timeZone`. */
export function toLocalDateKey(instant: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(instant);

  const part = (type: Intl.DateTimeFormatPartTypes): string => {
    const value = parts.find((p) => p.type === type)?.value;
    if (value === undefined) {
      throw new Error(`Unable to determine ${type} for time zone ${timeZone}`);
    }
    return value;
  };

  return `${part('year')}-${part('month')}-${part('day')}`;
}

/** True when `value` is a `YYYY-MM-DD` string naming a real calendar date. */
export function isDateKey(value: string): boolean {
  const match = DATE_KEY_PATTERN.exec(value);
  if (!match) return false;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
  );
}

/**
 * Formats a date key for display, e.g. "Friday, October 2". The key is interpreted as a
 * calendar date, so the result never shifts with the viewer's time zone.
 */
export function formatDateKey(
  dateKey: string,
  locale?: string,
  options: Intl.DateTimeFormatOptions = { weekday: 'long', month: 'long', day: 'numeric' },
): string {
  return new Intl.DateTimeFormat(locale, { ...options, timeZone: 'UTC' }).format(
    parseDateKey(dateKey),
  );
}

function parseDateKey(dateKey: string): Date {
  if (!isDateKey(dateKey)) {
    throw new RangeError(`Invalid date key: ${dateKey}`);
  }
  const [year, month, day] = dateKey.split('-').map(Number) as [number, number, number];
  return new Date(Date.UTC(year, month - 1, day));
}

function toDateKeyUTC(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Calendar arithmetic on date keys. Works on UTC midnight internally, where every day is
 * exactly 24 hours, so local DST transitions cannot skew the result.
 */
export function addDays(dateKey: string, days: number): string {
  const date = parseDateKey(dateKey);
  date.setUTCDate(date.getUTCDate() + days);
  return toDateKeyUTC(date);
}

/** Day of week for a date key: 0 = Sunday … 6 = Saturday. */
export function weekdayOf(dateKey: string): number {
  return parseDateKey(dateKey).getUTCDay();
}

/** Whole calendar days from `from` to `to` (negative when `to` is earlier). */
export function daysBetween(from: string, to: string): number {
  return Math.round((parseDateKey(to).getTime() - parseDateKey(from).getTime()) / 86_400_000);
}

/** First day of the week containing `dateKey`, for weeks starting on `weekStartsOn` (0 = Sunday). */
export function startOfWeek(dateKey: string, weekStartsOn: number): string {
  return addDays(dateKey, -((weekdayOf(dateKey) - weekStartsOn + 7) % 7));
}

/** Every date key from `from` to `to`, inclusive. Empty when `to` is before `from`. */
export function eachDay(from: string, to: string): string[] {
  const days: string[] = [];
  for (let day = from; day <= to; day = addDays(day, 1)) days.push(day);
  return days;
}

export function startOfMonth(dateKey: string): string {
  return `${dateKey.slice(0, 7)}-01`;
}

export function endOfMonth(dateKey: string): string {
  const [year, month] = dateKey.split('-').map(Number) as [number, number];
  // Day 0 of the next month is the last day of this month.
  return new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);
}

export function addMonths(dateKey: string, months: number): string {
  const [year, month] = dateKey.split('-').map(Number) as [number, number];
  const first = new Date(Date.UTC(year, month - 1 + months, 1));
  return first.toISOString().slice(0, 10);
}
