import type { Period, PeriodType } from '@/domain/review';

export const reviewPath = (period: Pick<Period, 'type' | 'start'>) =>
  `/review/${period.type}/${period.start}`;

export function percent(rate: number | null): string {
  return rate === null ? '—' : `${Math.round(rate * 100)}%`;
}

/** A rating, or an average of ratings, to at most one decimal: 4, 3.5. */
export function formatRating(rating: number): string {
  return Number.isInteger(rating) ? String(rating) : rating.toFixed(1);
}

export function plural(count: number, one: string, many = `${one}s`): string {
  return `${count} ${count === 1 ? one : many}`;
}

/** The word for each step of the 1–5 rating scale. */
export const RATING_WORDS = ['Rough', 'Meh', 'Okay', 'Good', 'Great'] as const;

/** Short badge text for each kind of review. */
export const PERIOD_BADGE: Record<PeriodType, string> = {
  daily: 'Day',
  weekly: 'Week',
  monthly: 'Month',
};
