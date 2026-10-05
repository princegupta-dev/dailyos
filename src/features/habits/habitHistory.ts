import {
  habitOccurrences,
  isActiveOn,
  isScheduledOn,
  summarizeOccurrences,
  type Habit,
  type HabitEntry,
  type Occurrence,
} from '@/domain/habit';
import { addDays, eachDay, startOfWeek, weekdayOf } from '@/lib/dates';

/** How one calendar day reads for a habit. Unscheduled days are never failures. */
export type DayState =
  'completed' | 'skipped' | 'missed' | 'pending' | 'unscheduled' | 'future' | 'outside';

export function dayState(
  habit: Habit,
  entry: HabitEntry | undefined,
  date: string,
  today: string,
): DayState {
  if (entry) return entry.status;
  if (date > today) return isScheduledOn(habit, date) ? 'future' : 'unscheduled';
  if (!isActiveOn(habit, date)) return 'unscheduled';
  // Weekly habits are judged per week, so an individual day without an entry isn't a miss.
  if (habit.frequency === 'weekly') return 'unscheduled';
  if (!isScheduledOn(habit, date)) return 'unscheduled';
  return date === today ? 'pending' : 'missed';
}

export interface WeekBar {
  start: string;
  /** completed / (completed + missed) that week, or null when nothing counted. */
  rate: number | null;
  completed: number;
}

/** Completion rate for each of the last `weeks` weeks, oldest first, ending this week. */
export function weeklyTrend(
  habit: Habit,
  entries: readonly HabitEntry[],
  today: string,
  lastDay: string,
  weekStartsOn: number,
  weeks = 12,
): WeekBar[] {
  const thisWeek = startOfWeek(today, weekStartsOn);
  return Array.from({ length: weeks }, (_, i) => {
    const start = addDays(thisWeek, -7 * (weeks - 1 - i));
    const end = addDays(start, 6);
    const to = end < lastDay ? end : lastDay;
    if (to < start) return { start, rate: null, completed: 0 };
    const summary = summarizeOccurrences(
      habitOccurrences(habit, entries, start, to, today, weekStartsOn),
    );
    return { start, rate: summary.rate, completed: summary.completed };
  });
}

/** Each day in the last `weeks` weeks (whole weeks, ending this week), with its state. */
export function heatmapDays(
  habit: Habit,
  entries: readonly HabitEntry[],
  today: string,
  weekStartsOn: number,
  weeks = 16,
): { date: string; state: DayState }[] {
  const byDate = new Map(entries.map((e) => [e.date, e]));
  const last = addDays(startOfWeek(today, weekStartsOn), 6);
  const first = addDays(last, -(weeks * 7 - 1));
  return eachDay(first, last).map((date) => ({
    date,
    state: dayState(habit, byDate.get(date), date, today),
  }));
}

/**
 * The weekday with the highest completion rate, if a daily or selected-days habit has at
 * least three counted occurrences on it. Returns its 0–6 index and rate.
 */
export function strongestWeekday(
  occurrences: readonly Occurrence[],
): { weekday: number; rate: number } | undefined {
  const counts = new Map<number, { done: number; counted: number }>();
  for (const o of occurrences) {
    if (o.status !== 'completed' && o.status !== 'missed') continue;
    const day = weekdayOf(o.start);
    const c = counts.get(day) ?? { done: 0, counted: 0 };
    c.counted += 1;
    if (o.status === 'completed') c.done += 1;
    counts.set(day, c);
  }
  let best: { weekday: number; rate: number } | undefined;
  for (const [weekday, { done, counted }] of counts) {
    if (counted < 3) continue;
    const rate = done / counted;
    if (!best || rate > best.rate) best = { weekday, rate };
  }
  return best;
}

const MILESTONES = [3, 7, 14, 21, 30, 50, 75, 100, 150, 200, 365];

/** The next streak milestone above `streak`, or undefined past the last one. */
export function nextMilestone(streak: number): number | undefined {
  return MILESTONES.find((m) => m > streak);
}
