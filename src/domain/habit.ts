import { z } from 'zod';
import { addDays, eachDay, startOfWeek, weekdayOf } from '@/lib/dates';
import { dateKeySchema, idSchema, optionalText, timestampSchema } from '@/lib/validation';
import { activityLogSchema } from './activityLog';
import { HABIT_ICONS, HABIT_TONES, TIMES_OF_DAY } from './appearance';
import { HABIT_CATEGORIES } from './categories';

export const HABIT_FREQUENCIES = ['daily', 'weekly', 'selected_days'] as const;
export type HabitFrequency = (typeof HABIT_FREQUENCIES)[number];

export const HABIT_STATUSES = ['completed', 'skipped', 'missed'] as const;
export type HabitStatus = (typeof HABIT_STATUSES)[number];

const weekdaysSchema = z
  .array(z.number().int().min(0).max(6))
  .refine((days) => new Set(days).size === days.length, 'Weekdays must be unique');

const tagsSchema = z
  .array(z.string().trim().min(1).max(40))
  .max(20)
  .transform((tags) => [...new Set(tags)]);

export const habitSchema = z.object({
  id: idSchema,
  name: z.string().trim().min(1).max(80),
  description: optionalText(500),
  category: z.enum(HABIT_CATEGORIES),
  frequency: z.enum(HABIT_FREQUENCIES),
  /** Required for `selected_days`; 0 = Sunday … 6 = Saturday. */
  weekdays: weekdaysSchema.optional(),
  /** Optional goal per occurrence, e.g. 30 (unit "min") or 20 (unit "pages"). */
  target: z.number().positive().max(100_000).optional(),
  unit: optionalText(20),
  /** The smallest version that still counts on a hard day, e.g. "10 minutes". */
  minimumTarget: optionalText(120),
  /** Other activities that also count, e.g. "Running" for a gym habit. */
  alternatives: z.array(z.string().trim().min(1).max(60)).max(8).optional(),
  /** Own icon and tile color. Absent means the category's (see CATEGORY_APPEARANCE). */
  icon: z.enum(HABIT_ICONS).optional(),
  tone: z.enum(HABIT_TONES).optional(),
  /** When it usually happens, and what it follows ("after coffee"). Shown, never notified. */
  timeOfDay: z.enum(TIMES_OF_DAY).optional(),
  cue: optionalText(80),
  /** First local date the habit counts. Entries and occurrences before it are ignored. */
  startDate: dateKeySchema,
  position: z.number().int().min(0),
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
  archivedAt: timestampSchema.optional(),
  /** Local date the habit ended. It no longer counts from this date on. */
  archivedOn: dateKeySchema.optional(),
});
export type Habit = z.infer<typeof habitSchema>;

export const habitDraftSchema = z
  .object({
    name: z.string().trim().min(1, 'Name is required').max(80, 'Keep the name under 80 characters'),
    description: optionalText(500),
    category: z.enum(HABIT_CATEGORIES).default('other'),
    frequency: z.enum(HABIT_FREQUENCIES),
    weekdays: weekdaysSchema.optional(),
    target: z.number().positive('Use a positive number').max(100_000).optional(),
    unit: optionalText(20),
    minimumTarget: optionalText(120),
    alternatives: z.array(z.string().trim().max(60)).max(8, 'Up to 8 alternatives').optional(),
    icon: z.enum(HABIT_ICONS).optional(),
    tone: z.enum(HABIT_TONES).optional(),
    timeOfDay: z.enum(TIMES_OF_DAY).optional(),
    cue: optionalText(80),
    /** Creation only: the first day the habit counts. Defaults to today. */
    startDate: dateKeySchema.optional(),
  })
  .refine((h) => h.frequency !== 'selected_days' || (h.weekdays?.length ?? 0) > 0, {
    path: ['weekdays'],
    message: 'Choose at least one day',
  })
  .transform((h) => {
    const alternatives = [...new Set((h.alternatives ?? []).filter((a) => a !== ''))];
    return {
      ...h,
      weekdays: h.frequency === 'selected_days' ? [...(h.weekdays ?? [])].sort() : undefined,
      unit: h.target === undefined ? undefined : h.unit,
      alternatives: alternatives.length > 0 ? alternatives : undefined,
    };
  });
export type HabitDraft = z.input<typeof habitDraftSchema>;

export const habitEntrySchema = z.object({
  id: idSchema,
  habitId: idSchema,
  date: dateKeySchema,
  status: z.enum(HABIT_STATUSES),
  note: optionalText(500),
  /** Progress toward the habit's target, in its unit. */
  amount: z.number().min(0).max(100_000).optional(),
  /** Done the minimum version. Still counts as completed. */
  minimum: z.boolean().optional(),
  /** Which alternative was done instead of the main activity, if any. */
  alternative: optionalText(60),
  /** Optional category-specific details (see domain/activityLog.ts). */
  log: activityLogSchema.optional(),
  tags: tagsSchema,
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
});
export type HabitEntry = z.infer<typeof habitEntrySchema>;

/** Optional details recorded with a status. Everything here can be left out. */
export const habitEntryDetailsSchema = z.object({
  note: optionalText(500),
  amount: z.number().min(0, 'Use zero or more').max(100_000).optional(),
  minimum: z.boolean().optional(),
  alternative: optionalText(60),
  log: activityLogSchema.optional(),
  tags: tagsSchema.default([]),
});
export type HabitEntryDetails = z.input<typeof habitEntryDetailsSchema>;

export type OccurrenceStatus = HabitStatus | 'pending';

/**
 * One chance to do a habit. Daily and selected-day habits have one per scheduled date; weekly
 * habits have one per week, satisfied by an entry on any day of that week.
 */
export interface Occurrence {
  start: string;
  end: string;
  status: OccurrenceStatus;
}

export function isActiveOn(habit: Pick<Habit, 'startDate' | 'archivedOn'>, date: string): boolean {
  return date >= habit.startDate && (habit.archivedOn === undefined || date < habit.archivedOn);
}

/** Whether an entry may be recorded for `date` (weekly habits accept any active day). */
export function isScheduledOn(habit: Habit, date: string): boolean {
  if (!isActiveOn(habit, date)) return false;
  if (habit.frequency === 'selected_days') return (habit.weekdays ?? []).includes(weekdayOf(date));
  return true;
}

function statusFromEntries(entries: readonly HabitEntry[]): HabitStatus | undefined {
  if (entries.some((e) => e.status === 'completed')) return 'completed';
  if (entries.some((e) => e.status === 'skipped')) return 'skipped';
  if (entries.some((e) => e.status === 'missed')) return 'missed';
  return undefined;
}

/**
 * Occurrences that fall in [from, to] and have started by `today`. Future occurrences are not
 * eligible yet. A past occurrence without an entry counts as missed; today's (or this week's)
 * occurrence without an entry is pending, not a failure.
 *
 * Weekly occurrences belong to the range containing their week's first day, so a week is
 * never counted twice across consecutive ranges.
 */
export function habitOccurrences(
  habit: Habit,
  entries: readonly HabitEntry[],
  from: string,
  to: string,
  today: string,
  weekStartsOn: number,
): Occurrence[] {
  const byDate = new Map<string, HabitEntry[]>();
  for (const entry of entries) {
    if (entry.habitId !== habit.id) continue;
    byDate.set(entry.date, [...(byDate.get(entry.date) ?? []), entry]);
  }
  const last = to < today ? to : today;

  if (habit.frequency !== 'weekly') {
    return eachDay(from, last)
      .filter((date) => isScheduledOn(habit, date))
      .map((date) => ({
        start: date,
        end: date,
        status: statusFromEntries(byDate.get(date) ?? []) ?? (date < today ? 'missed' : 'pending'),
      }));
  }

  const occurrences: Occurrence[] = [];
  for (let week = startOfWeek(from, weekStartsOn); week <= last; week = addDays(week, 7)) {
    if (week < from) continue;
    const end = addDays(week, 6);
    const activeDays = eachDay(week, end).filter((d) => isActiveOn(habit, d));
    if (activeDays.length === 0) continue;
    const status =
      statusFromEntries(activeDays.flatMap((d) => byDate.get(d) ?? [])) ??
      (end < today ? 'missed' : 'pending');
    occurrences.push({ start: week, end, status });
  }
  return occurrences;
}

/** The occurrence covering `date` (for weekly habits, the week containing it), if eligible. */
export function occurrenceFor(
  habit: Habit,
  entries: readonly HabitEntry[],
  date: string,
  today: string,
  weekStartsOn: number,
): Occurrence | undefined {
  if (habit.frequency !== 'weekly') {
    return habitOccurrences(habit, entries, date, date, today, weekStartsOn)[0];
  }
  const week = startOfWeek(date, weekStartsOn);
  return habitOccurrences(habit, entries, week, addDays(week, 6), today, weekStartsOn)[0];
}

/** All occurrences from the habit's start through `today`. */
export function occurrencesToDate(
  habit: Habit,
  entries: readonly HabitEntry[],
  today: string,
  weekStartsOn: number,
): Occurrence[] {
  const from =
    habit.frequency === 'weekly' ? startOfWeek(habit.startDate, weekStartsOn) : habit.startDate;
  return habitOccurrences(habit, entries, from, today, today, weekStartsOn);
}

export interface OccurrenceSummary {
  completed: number;
  skipped: number;
  missed: number;
  pending: number;
  /** completed / (completed + missed). Skipped and pending don't count against you. */
  rate: number | null;
}

export function summarizeOccurrences(occurrences: readonly Occurrence[]): OccurrenceSummary {
  const count = (status: OccurrenceStatus) => occurrences.filter((o) => o.status === status).length;
  const completed = count('completed');
  const missed = count('missed');
  return {
    completed,
    skipped: count('skipped'),
    missed,
    pending: count('pending'),
    rate: completed + missed === 0 ? null : completed / (completed + missed),
  };
}

/**
 * Consecutive completed occurrences ending at the latest one. Skipped occurrences are
 * neutral (they neither extend nor break a streak), and a still-pending occurrence today
 * doesn't break it either. Counted in occurrences, never in 24-hour periods.
 */
export function currentStreak(occurrences: readonly Occurrence[]): number {
  let streak = 0;
  for (let i = occurrences.length - 1; i >= 0; i--) {
    const status = occurrences[i]?.status;
    if (status === 'completed') streak++;
    else if (status === 'missed') break;
  }
  return streak;
}

/**
 * Longest run of completed occurrences in history. Same rules as the current streak:
 * skipped occurrences are neutral, missed ones end a run, unscheduled days don't exist as
 * occurrences at all, and a pending occurrence neither extends nor ends a run.
 */
export function longestStreak(occurrences: readonly Occurrence[]): number {
  let longest = 0;
  let run = 0;
  for (const { status } of occurrences) {
    if (status === 'completed') longest = Math.max(longest, ++run);
    else if (status === 'missed') run = 0;
  }
  return longest;
}

export interface HabitStats {
  currentStreak: number;
  longestStreak: number;
  totalCompletions: number;
}

export function habitStats(occurrences: readonly Occurrence[]): HabitStats {
  return {
    currentStreak: currentStreak(occurrences),
    longestStreak: longestStreak(occurrences),
    totalCompletions: occurrences.filter((o) => o.status === 'completed').length,
  };
}

export const WEEKDAYS_MON_FRI = [1, 2, 3, 4, 5] as const;

/** True when a selected-days schedule is exactly Monday–Friday. */
export function isWeekdaysSchedule(habit: Pick<Habit, 'frequency' | 'weekdays'>): boolean {
  const days = habit.weekdays ?? [];
  return (
    habit.frequency === 'selected_days' &&
    days.length === WEEKDAYS_MON_FRI.length &&
    WEEKDAYS_MON_FRI.every((d) => days.includes(d))
  );
}

/** "30 min", "20 pages", or undefined when there's no target. */
export function describeTarget(habit: Pick<Habit, 'target' | 'unit'>): string | undefined {
  if (habit.target === undefined) return undefined;
  return habit.unit ? `${habit.target} ${habit.unit}` : String(habit.target);
}

export const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

export function describeSchedule(habit: Pick<Habit, 'frequency' | 'weekdays'>): string {
  if (habit.frequency === 'daily') return 'Every day';
  if (habit.frequency === 'weekly') return 'Once a week';
  if (isWeekdaysSchedule(habit)) return 'Weekdays';
  return (habit.weekdays ?? []).map((d) => WEEKDAY_SHORT[d]).join(', ');
}
