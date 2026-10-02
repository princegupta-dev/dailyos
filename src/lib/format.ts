import { addDays, formatDateKey } from './dates';

/** "Today", "Tomorrow", "Yesterday", or a short date like "Fri, Oct 2". */
export function relativeDayLabel(dateKey: string, today: string, locale?: string): string {
  if (dateKey === today) return 'Today';
  if (dateKey === addDays(today, 1)) return 'Tomorrow';
  if (dateKey === addDays(today, -1)) return 'Yesterday';
  const sameYear = dateKey.slice(0, 4) === today.slice(0, 4);
  return formatDateKey(dateKey, locale, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    ...(sameYear ? {} : { year: 'numeric' }),
  });
}

const RELATIVE_WORDS = new Set(['Today', 'Tomorrow', 'Yesterday']);

/** Day label for use mid-sentence: "today", "tomorrow", or "Fri, Oct 2". */
export function inlineDayLabel(dateKey: string, today: string, locale?: string): string {
  const label = relativeDayLabel(dateKey, today, locale);
  return RELATIVE_WORDS.has(label) ? label.toLowerCase() : label;
}

/** A timestamp shown in the given zone, e.g. "Oct 2, 3:05 PM". */
export function formatTimestamp(iso: string, timeZone: string, locale?: string): string {
  return new Intl.DateTimeFormat(locale, {
    timeZone,
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(iso));
}

export function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`;
}

/** A timestamp with its year, e.g. "Oct 2, 2026, 3:05 PM", for records that may be old. */
export function formatFullTimestamp(iso: string, timeZone: string, locale?: string): string {
  return new Intl.DateTimeFormat(locale, {
    timeZone,
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(iso));
}
