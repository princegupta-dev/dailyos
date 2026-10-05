import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '@/db/database';
import {
  createHabit,
  endHabit,
  getHabitDetail,
  getHabitsForDay,
  listHabits,
  setHabitStatus,
  updateHabit,
} from '@/db/repositories/habits';
import { resetDatabase, setNow } from '../helpers/db';

beforeEach(async () => {
  await resetDatabase();
  setNow('2026-09-28T08:00:00Z'); // Monday
});

afterEach(() => {
  vi.useRealTimers();
});

describe('habit definitions', () => {
  it('creates habits starting today and validates schedules', async () => {
    const habit = await createHabit({ name: 'Read', frequency: 'daily' });
    expect(habit).toMatchObject({ startDate: '2026-09-28', position: 0 });
    expect(habit).not.toHaveProperty('weekdays');

    await expect(
      createHabit({ name: 'Gym', frequency: 'selected_days', weekdays: [] }),
    ).rejects.toMatchObject({
      kind: 'validation',
      issues: [{ path: 'weekdays', message: 'Choose at least one day' }],
    });
  });

  it('edits name and schedule, clearing fields that were removed', async () => {
    const habit = await createHabit({
      name: 'Gym',
      description: 'Legs',
      frequency: 'selected_days',
      weekdays: [1],
    });
    const updated = await updateHabit(habit.id, { name: 'Run', frequency: 'daily' });
    expect(updated).toMatchObject({ name: 'Run', frequency: 'daily' });
    expect(updated).not.toHaveProperty('weekdays');
    expect(updated).not.toHaveProperty('description');
  });

  it('ending a habit keeps its entries and hides it from active lists', async () => {
    const habit = await createHabit({ name: 'Read', frequency: 'daily' });
    await setHabitStatus(habit.id, '2026-09-28', 'completed');
    setNow('2026-09-30T08:00:00Z');
    const ended = await endHabit(habit.id);
    expect(ended.archivedOn).toBe('2026-09-30');

    expect(await listHabits()).toEqual([]);
    expect((await listHabits(true)).map((h) => h.id)).toEqual([habit.id]);
    expect((await getHabitDetail(habit.id))?.entries).toHaveLength(1);
    await expect(setHabitStatus(habit.id, '2026-09-30', 'completed')).rejects.toMatchObject({
      kind: 'invalid_operation',
    });
    await expect(updateHabit(habit.id, { name: 'x', frequency: 'daily' })).rejects.toMatchObject({
      kind: 'invalid_operation',
    });
  });
});

describe('habit entries', () => {
  it('keeps at most one record per habit and date, updating in place', async () => {
    const habit = await createHabit({ name: 'Read', frequency: 'daily' });
    await setHabitStatus(habit.id, '2026-09-28', 'skipped', { note: 'Travel day' });
    setNow('2026-09-28T20:00:00Z');
    await setHabitStatus(habit.id, '2026-09-28', 'completed');

    const entries = await db.habitEntries.toArray();
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      status: 'completed',
      createdAt: '2026-09-28T08:00:00.000Z',
    });
    // Changing only the status keeps details recorded earlier.
    expect(entries[0]?.note).toBe('Travel day');
  });

  it('records optional activity details and replaces them only when new details are given', async () => {
    const gym = await createHabit({
      name: 'Gym',
      category: 'fitness',
      frequency: 'daily',
      target: 45,
      unit: 'min',
    });
    await setHabitStatus(gym.id, '2026-09-28', 'completed', {
      amount: 50,
      log: { workout: 'Push day', durationMin: 50, details: '' },
      tags: ['Strength', 'Strength'],
    });
    let [entry] = await db.habitEntries.toArray();
    expect(entry).toMatchObject({
      amount: 50,
      log: { workout: 'Push day', durationMin: 50 },
      tags: ['Strength'],
    });
    expect(entry?.log).not.toHaveProperty('details');

    await setHabitStatus(gym.id, '2026-09-28', 'completed', { minimum: true });
    [entry] = await db.habitEntries.toArray();
    expect(entry).toMatchObject({ minimum: true, tags: [] });
    expect(entry).not.toHaveProperty('log');
    expect(entry).not.toHaveProperty('amount');
  });

  it('only flags "did the minimum" on completions', async () => {
    const habit = await createHabit({ name: 'Read', frequency: 'daily' });
    await setHabitStatus(habit.id, '2026-09-28', 'skipped', { minimum: true });
    expect((await db.habitEntries.toArray())[0]).not.toHaveProperty('minimum');
  });

  it('the database itself rejects a second record for the same habit and date', async () => {
    const habit = await createHabit({ name: 'Read', frequency: 'daily' });
    await setHabitStatus(habit.id, '2026-09-28', 'completed');
    const [existing] = await db.habitEntries.toArray();
    await expect(
      db.habitEntries.add({ ...existing!, id: '6c7d8e9f-0a1b-4c2d-8e3f-405162738495' }),
    ).rejects.toMatchObject({ name: 'ConstraintError' });
  });

  it('clears a status with null', async () => {
    const habit = await createHabit({ name: 'Read', frequency: 'daily' });
    await setHabitStatus(habit.id, '2026-09-28', 'completed');
    await setHabitStatus(habit.id, '2026-09-28', null);
    expect(await db.habitEntries.count()).toBe(0);
  });

  it('rejects future dates, dates before the start, and unscheduled days', async () => {
    const habit = await createHabit({ name: 'Gym', frequency: 'selected_days', weekdays: [1, 3] });
    await expect(setHabitStatus(habit.id, '2026-09-30', 'completed')).rejects.toMatchObject({
      kind: 'invalid_operation',
    });
    await expect(setHabitStatus(habit.id, '2026-09-27', 'completed')).rejects.toMatchObject({
      kind: 'invalid_operation',
    });
    setNow('2026-09-29T08:00:00Z'); // Tuesday — not scheduled
    await expect(setHabitStatus(habit.id, '2026-09-29', 'completed')).rejects.toMatchObject({
      kind: 'invalid_operation',
    });
  });
});

describe('habits for a day', () => {
  it('lists eligible habits with status and streak, honouring schedules', async () => {
    const read = await createHabit({ name: 'Read', frequency: 'daily' });
    const gym = await createHabit({ name: 'Gym', frequency: 'selected_days', weekdays: [1, 3] });
    const review = await createHabit({ name: 'Weekly review', frequency: 'weekly' });

    await setHabitStatus(read.id, '2026-09-28', 'completed');
    await setHabitStatus(review.id, '2026-09-28', 'completed');
    setNow('2026-09-29T08:00:00Z');
    await setHabitStatus(read.id, '2026-09-29', 'completed');

    const tuesday = await getHabitsForDay('2026-09-29', '2026-09-29', 1);
    expect(tuesday.map((h) => [h.habit.name, h.occurrence.status, h.streak])).toEqual([
      ['Read', 'completed', 2],
      ['Weekly review', 'completed', 1],
    ]);
    expect(tuesday.some((h) => h.habit.id === gym.id)).toBe(false);
    // The weekly completion was recorded Monday, not on Tuesday itself.
    expect(tuesday[1]?.entry).toBeUndefined();
  });
});

describe('local date boundaries', () => {
  it('uses the configured time zone to decide which day "today" is', async () => {
    await resetDatabase('Pacific/Auckland');
    setNow('2026-09-28T13:30:00Z'); // 02:30 on Sep 29 in Auckland (UTC+13)
    const habit = await createHabit({ name: 'Read', frequency: 'daily' });
    expect(habit.startDate).toBe('2026-09-29');

    await setHabitStatus(habit.id, '2026-09-29', 'completed');
    // Sep 30 is still in the future in Auckland, even though it's within 24 hours.
    await expect(setHabitStatus(habit.id, '2026-09-30', 'completed')).rejects.toMatchObject({
      kind: 'invalid_operation',
    });
  });
});

describe('habit appearance, timing, and start', () => {
  it('saves its own icon, tone, time of day, and cue', async () => {
    const habit = await createHabit({
      name: 'Meditate',
      category: 'mindfulness',
      frequency: 'daily',
      icon: 'brain',
      tone: 'teal',
      timeOfDay: 'morning',
      cue: 'After coffee',
    });
    expect(habit).toMatchObject({
      category: 'mindfulness',
      icon: 'brain',
      tone: 'teal',
      timeOfDay: 'morning',
      cue: 'After coffee',
    });
  });

  it('starts on a chosen future day and never in the past', async () => {
    const later = await createHabit({ name: 'Run', frequency: 'daily', startDate: '2026-10-05' });
    expect(later.startDate).toBe('2026-10-05');
    expect((await getHabitsForDay('2026-09-28', '2026-09-28', 1)).map((h) => h.habit.id)).toEqual(
      [],
    );

    await expect(
      createHabit({ name: 'Read', frequency: 'daily', startDate: '2026-09-27' }),
    ).rejects.toMatchObject({ kind: 'validation', issues: [{ path: 'startDate' }] });
  });

  it('keeps the start date when edited, and clears appearance left out of the edit', async () => {
    const habit = await createHabit({
      name: 'Run',
      frequency: 'daily',
      startDate: '2026-10-05',
      icon: 'bike',
      cue: 'After work',
    });
    const edited = await updateHabit(habit.id, {
      name: 'Run',
      frequency: 'daily',
      startDate: '2026-10-20',
    });
    expect(edited.startDate).toBe('2026-10-05');
    expect(edited).not.toHaveProperty('icon');
    expect(edited).not.toHaveProperty('cue');
  });
});
