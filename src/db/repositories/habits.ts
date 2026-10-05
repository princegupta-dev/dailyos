import {
  habitDraftSchema,
  habitEntryDetailsSchema,
  habitOccurrences,
  habitStats,
  isScheduledOn,
  occurrenceFor,
  occurrencesToDate,
  summarizeOccurrences,
  type Habit,
  type HabitDraft,
  type HabitEntry,
  type HabitEntryDetails,
  type HabitStats,
  type HabitStatus,
  type Occurrence,
  type OccurrenceStatus,
} from '@/domain/habit';
import { groupBy } from '@/lib/collections';
import { addDays, startOfWeek } from '@/lib/dates';
import { newId } from '@/lib/ids';
import { db } from '../database';
import { AppError } from '../errors';
import { compact, guard, notFound, parseInput, writeContext } from './internal';

async function requireHabit(id: string): Promise<Habit> {
  const habit = await db.habits.get(id);
  if (!habit) throw notFound('Habit');
  return habit;
}

export async function createHabit(draft: HabitDraft): Promise<Habit> {
  const { startDate, ...fields } = parseInput(habitDraftSchema, draft);
  return guard(async () => {
    const ctx = await writeContext();
    // A habit can start today or later, never in the past: past days would count as missed.
    if (startDate !== undefined && startDate < ctx.today) {
      throw new AppError('validation', 'Some fields need attention.', {
        issues: [{ path: 'startDate', message: 'Pick today or a later day' }],
      });
    }
    return db.transaction('rw', db.habits, async () => {
      const habit: Habit = compact({
        id: newId(),
        ...fields,
        startDate: startDate ?? ctx.today,
        position: await db.habits.count(),
        createdAt: ctx.now,
        updatedAt: ctx.now,
      });
      await db.habits.add(habit);
      return habit;
    });
  });
}

/**
 * Edits a habit's name, description, or schedule. Changing the schedule applies to how all
 * past occurrences are evaluated too; entries themselves are never altered.
 */
export async function updateHabit(id: string, draft: HabitDraft): Promise<Habit> {
  const fields = parseInput(habitDraftSchema, draft);
  return guard(async () => {
    const ctx = await writeContext();
    return db.transaction('rw', db.habits, async () => {
      const habit = await requireHabit(id);
      if (habit.archivedOn !== undefined) {
        throw new AppError('invalid_operation', 'Ended habits can’t be edited.');
      }
      const updated: Habit = compact({
        ...habit,
        // Optional fields absent from the draft are cleared (unit and alternatives are
        // always present in the parsed draft).
        description: undefined,
        target: undefined,
        minimumTarget: undefined,
        icon: undefined,
        tone: undefined,
        timeOfDay: undefined,
        cue: undefined,
        ...fields,
        // The start date is set once, at creation; editing never moves it.
        startDate: habit.startDate,
        updatedAt: ctx.now,
      });
      await db.habits.put(updated);
      return updated;
    });
  });
}

/**
 * Ends a habit from today on. Its entries and past occurrences stay in history and reviews.
 * Ending is permanent: resuming would make the gap look like missed days, so start a new
 * habit instead.
 */
export async function endHabit(id: string): Promise<Habit> {
  return guard(async () => {
    const ctx = await writeContext();
    return db.transaction('rw', db.habits, async () => {
      const habit = await requireHabit(id);
      if (habit.archivedOn !== undefined) return habit;
      const updated: Habit = {
        ...habit,
        archivedAt: ctx.now,
        archivedOn: ctx.today,
        updatedAt: ctx.now,
      };
      await db.habits.put(updated);
      return updated;
    });
  });
}

/**
 * Records the status for one habit on one date, or clears it with `null` (e.g. to correct an
 * accidental check-off). The unique [habitId+date] index guarantees at most one record; this
 * upserts within a transaction.
 *
 * `details` (note, amount, activity log, tags) are optional. When omitted, details already
 * recorded for that date are kept, so changing only the status never loses a log.
 */
export async function setHabitStatus(
  habitId: string,
  date: string,
  status: HabitStatus | null,
  details?: HabitEntryDetails,
): Promise<void> {
  const parsedDetails =
    details === undefined ? undefined : parseInput(habitEntryDetailsSchema, details);
  return guard(async () => {
    const ctx = await writeContext();
    if (date > ctx.today) {
      throw new AppError('invalid_operation', 'You can’t record a habit for a future date.');
    }
    await db.transaction('rw', db.habits, db.habitEntries, async () => {
      const habit = await requireHabit(habitId);
      if (!isScheduledOn(habit, date)) {
        throw new AppError('invalid_operation', `“${habit.name}” isn’t scheduled for that date.`);
      }
      const existing = await db.habitEntries
        .where('[habitId+date]')
        .equals([habitId, date])
        .first();
      if (status === null) {
        if (existing) await db.habitEntries.delete(existing.id);
        return;
      }
      const kept = parsedDetails ?? {
        note: existing?.note,
        amount: existing?.amount,
        minimum: existing?.minimum,
        alternative: existing?.alternative,
        log: existing?.log,
        tags: existing?.tags ?? [],
      };
      const entry: HabitEntry = compact({
        id: existing?.id ?? newId(),
        habitId,
        date,
        status,
        ...kept,
        log: kept.log && Object.keys(kept.log).length > 0 ? kept.log : undefined,
        // "Did the minimum" only makes sense for a completion.
        minimum: status === 'completed' && kept.minimum ? true : undefined,
        createdAt: existing?.createdAt ?? ctx.now,
        updatedAt: ctx.now,
      });
      await db.habitEntries.put(entry);
    });
  });
}

/* Reads call Dexie directly so live queries track them (see the note in tasks.ts). */

export async function listHabits(includeEnded = false): Promise<Habit[]> {
  const habits = await db.habits.toArray();
  return habits
    .filter((h) => includeEnded || h.archivedOn === undefined)
    .sort((a, b) => a.position - b.position || a.createdAt.localeCompare(b.createdAt));
}

export interface HabitDayStatus {
  habit: Habit;
  occurrence: Occurrence;
  /** The entry recorded on this exact date, if any. */
  entry?: HabitEntry | undefined;
  /** Current streak (kept for existing callers; same as stats.currentStreak). */
  streak: number;
  stats: HabitStats;
}

/** Habits eligible on `date`, with their status, today's entry, and current streak. */
export async function getHabitsForDay(
  date: string,
  today: string,
  weekStartsOn: number,
): Promise<HabitDayStatus[]> {
  const habits = (await db.habits.toArray()).sort((a, b) => a.position - b.position);
  const entries = await db.habitEntries.toArray();
  const byHabit = groupBy(entries, (e) => e.habitId);
  return habits.flatMap((habit) => {
    const own = byHabit.get(habit.id) ?? [];
    const occurrence = occurrenceFor(habit, own, date, today, weekStartsOn);
    if (!occurrence) return [];
    // A weekly habit stays listed all week, but only days it's active on accept entries.
    if (!isScheduledOn(habit, date)) return [];
    return [
      {
        habit,
        occurrence,
        entry: own.find((e) => e.date === date),
        ...withStats(habitStats(occurrencesToDate(habit, own, today, weekStartsOn))),
      },
    ];
  });
}

function withStats(stats: HabitStats) {
  return { streak: stats.currentStreak, stats };
}

export interface WeekConsistency {
  /** Completed occurrences so far this week, across active habits. */
  completed: number;
  /** completed + missed so far (skipped and still-pending ones are left out). */
  counted: number;
  rate: number | null;
}

/**
 * How the week is going so far: completed vs. eligible occurrences from the start of the
 * week through today. Shown as a small indicator on Today, never as a score.
 */
export async function getWeekConsistency(
  today: string,
  weekStartsOn: number,
): Promise<WeekConsistency> {
  const from = startOfWeek(today, weekStartsOn);
  const habits = await db.habits.toArray();
  const entries = await db.habitEntries.where('date').between(from, today, true, true).toArray();
  const byHabit = groupBy(entries, (e) => e.habitId);
  const summary = summarizeOccurrences(
    habits.flatMap((h) =>
      habitOccurrences(h, byHabit.get(h.id) ?? [], from, today, today, weekStartsOn),
    ),
  );
  return {
    completed: summary.completed,
    counted: summary.completed + summary.missed,
    rate: summary.rate,
  };
}

/**
 * Each habit's occurrences over the last `days` days through `today`, keyed by habit id, for
 * recent-activity displays. Weekly habits contribute the weeks that start inside the range.
 */
export async function getRecentOccurrences(
  today: string,
  weekStartsOn: number,
  days = 30,
): Promise<Map<string, Occurrence[]>> {
  const from = addDays(today, -(days - 1));
  const habits = await db.habits.toArray();
  const entries = await db.habitEntries.where('date').between(from, today, true, true).toArray();
  const byHabit = groupBy(entries, (e) => e.habitId);
  return new Map(
    habits.map((h) => [
      h.id,
      habitOccurrences(h, byHabit.get(h.id) ?? [], from, today, today, weekStartsOn),
    ]),
  );
}

export interface HabitDetail {
  habit: Habit;
  entries: HabitEntry[];
}

export async function getHabitDetail(id: string): Promise<HabitDetail | undefined> {
  const habit = await db.habits.get(id);
  if (!habit) return undefined;
  const entries = await db.habitEntries.where('habitId').equals(id).toArray();
  return { habit, entries: entries.sort((a, b) => a.date.localeCompare(b.date)) };
}

export interface HabitSummary {
  habit: Habit;
  stats: HabitStats;
  /** Entry for `today`, if any. */
  todayEntry?: HabitEntry | undefined;
  /**
   * Status of the occurrence covering today (a weekly habit's covers the whole week), or null
   * when the habit can't be checked off today: not scheduled, not started yet, or ended.
   */
  todayStatus: OccurrenceStatus | null;
}

/** Every habit (ended ones only when asked) with streaks and totals to date. */
export async function listHabitSummaries(
  today: string,
  weekStartsOn: number,
  includeEnded = false,
): Promise<HabitSummary[]> {
  const habits = (await db.habits.toArray())
    .filter((h) => includeEnded || h.archivedOn === undefined)
    .sort((a, b) => a.position - b.position || a.createdAt.localeCompare(b.createdAt));
  const entries = await db.habitEntries.toArray();
  const byHabit = groupBy(entries, (e) => e.habitId);
  return habits.map((habit) => {
    const own = byHabit.get(habit.id) ?? [];
    const end =
      habit.archivedOn && habit.archivedOn <= today ? addDays(habit.archivedOn, -1) : today;
    return {
      habit,
      stats: habitStats(occurrencesToDate(habit, own, end, weekStartsOn)),
      todayEntry: own.find((e) => e.date === today),
      todayStatus: isScheduledOn(habit, today)
        ? (occurrenceFor(habit, own, today, today, weekStartsOn)?.status ?? null)
        : null,
    };
  });
}
