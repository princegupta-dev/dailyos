import type { Period } from '@/domain/review';

export const reviewPath = (period: Pick<Period, 'type' | 'start'>) =>
  `/review/${period.type}/${period.start}`;

export function percent(rate: number | null): string {
  return rate === null ? '—' : `${Math.round(rate * 100)}%`;
}

export function plural(count: number, one: string, many = `${one}s`): string {
  return `${count} ${count === 1 ? one : many}`;
}
