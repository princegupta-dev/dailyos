import {
  currentStreak,
  habitDraftSchema,
  isScheduledOn,
  occurrenceFor,
  occurrencesToDate,
  type Habit,
  type HabitDraft,
  type HabitEntry,
  type HabitStatus,
  type Occurrence,
} from '@/domain/habit';
import { groupBy } from '@/lib/collections';
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
  const fields = parseInput(habitDraftSchema, draft);
  return guard(async () => {
    const ctx = await writeContext();
    return db.transaction('rw', db.habits, async () => {
      const habit: Habit = compact({
        id: newId(),
        ...fields,
        startDate: ctx.today,
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
        description: undefined, // cleared unless the draft provides one
        ...fields,
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
 * Records the status for one habit on one date, or clears it with `null`. The unique
 * [habitId+date] index guarantees at most one record; this upserts within a transaction.
 */
export async function setHabitStatus(
  habitId: string,
  date: string,
  status: HabitStatus | null,
  note?: string,
): Promise<void> {
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
      const entry: HabitEntry = compact({
        id: existing?.id ?? newId(),
        habitId,
        date,
        status,
        note: note?.trim() === '' ? undefined : note?.trim(),
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
  streak: number;
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
        streak: currentStreak(occurrencesToDate(habit, own, today, weekStartsOn)),
      },
    ];
  });
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
