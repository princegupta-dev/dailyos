import { z } from 'zod';
import {
  addDays,
  addMonths,
  endOfMonth,
  formatDateKey,
  isDateKey,
  startOfMonth,
  startOfWeek,
} from '@/lib/dates';
import { dateKeySchema, idSchema, timestampSchema } from '@/lib/validation';

export const PERIOD_TYPES = ['daily', 'weekly', 'monthly'] as const;
export type PeriodType = (typeof PERIOD_TYPES)[number];

const reflection = z.string().trim().max(5000);

export const reviewSchema = z.object({
  id: idSchema,
  periodType: z.enum(PERIOD_TYPES),
  periodStart: dateKeySchema,
  periodEnd: dateKeySchema,
  wins: reflection,
  blockers: reflection,
  lessons: reflection,
  improvements: reflection,
  /** Focus for the next period: tomorrow, next week, or next month. */
  focus: z.string().trim().max(1000),
  rating: z.number().int().min(1).max(5).optional(),
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
});
export type Review = z.infer<typeof reviewSchema>;

export const REVIEW_ACTION_STATUSES = ['open', 'done'] as const;
export type ReviewActionStatus = (typeof REVIEW_ACTION_STATUSES)[number];

/**
 * A next action decided in a review. Open actions carry forward: they stay visible in later
 * reviews and on Today until marked done, without being copied.
 */
export const reviewActionSchema = z.object({
  id: idSchema,
  reviewId: idSchema,
  title: z.string().trim().min(1).max(200),
  status: z.enum(REVIEW_ACTION_STATUSES),
  /** Order within the review, as the person listed them. */
  position: z.number().int().min(0),
  targetDate: dateKeySchema.optional(),
  /** Set when the action was turned into a task. */
  taskId: idSchema.optional(),
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
  completedAt: timestampSchema.optional(),
});
export type ReviewAction = z.infer<typeof reviewActionSchema>;

export const reviewDraftSchema = z.object({
  wins: reflection.default(''),
  blockers: reflection.default(''),
  lessons: reflection.default(''),
  improvements: reflection.default(''),
  focus: z.string().trim().max(1000).default(''),
  rating: z.number().int().min(1, 'Rate from 1 to 5').max(5, 'Rate from 1 to 5').optional(),
  actions: z
    .array(
      z.object({
        id: idSchema.optional(),
        title: z.string().trim().max(200, 'Keep actions under 200 characters'),
        status: z.enum(REVIEW_ACTION_STATUSES).default('open'),
        targetDate: dateKeySchema.optional(),
      }),
    )
    .max(20, 'Keep it to 20 actions or fewer')
    .default([])
    .transform((actions) => actions.filter((a) => a.title !== '')),
});
export type ReviewDraft = z.input<typeof reviewDraftSchema>;

export interface Period {
  type: PeriodType;
  start: string;
  end: string;
}

/** The period of `type` containing `date`. */
export function periodContaining(type: PeriodType, date: string, weekStartsOn: number): Period {
  switch (type) {
    case 'daily':
      return { type, start: date, end: date };
    case 'weekly': {
      const start = startOfWeek(date, weekStartsOn);
      return { type, start, end: addDays(start, 6) };
    }
    case 'monthly':
      return { type, start: startOfMonth(date), end: endOfMonth(date) };
  }
}

export function shiftPeriod(period: Period, steps: number, weekStartsOn: number): Period {
  switch (period.type) {
    case 'daily':
      return periodContaining('daily', addDays(period.start, steps), weekStartsOn);
    case 'weekly':
      return periodContaining('weekly', addDays(period.start, 7 * steps), weekStartsOn);
    case 'monthly':
      return periodContaining('monthly', addMonths(period.start, steps), weekStartsOn);
  }
}

export function isPeriodType(value: string | undefined): value is PeriodType {
  return PERIOD_TYPES.some((t) => t === value);
}

/** Parses a period from route params, normalizing the start to the period's real start. */
export function parsePeriod(
  type: string | undefined,
  start: string | undefined,
  weekStartsOn: number,
): Period | undefined {
  if (!isPeriodType(type) || start === undefined || !isDateKey(start)) return undefined;
  return periodContaining(type, start, weekStartsOn);
}

export function periodLabel(period: Period, locale?: string): string {
  switch (period.type) {
    case 'daily':
      return formatDateKey(period.start, locale);
    case 'weekly':
      return `Week of ${formatDateKey(period.start, locale, { month: 'long', day: 'numeric' })}`;
    case 'monthly':
      return formatDateKey(period.start, locale, { month: 'long', year: 'numeric' });
  }
}

export const NEXT_PERIOD_NAME: Record<PeriodType, string> = {
  daily: 'tomorrow',
  weekly: 'next week',
  monthly: 'next month',
};

export const PERIOD_NOUN: Record<PeriodType, string> = {
  daily: 'Daily review',
  weekly: 'Weekly review',
  monthly: 'Monthly review',
};
