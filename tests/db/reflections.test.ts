import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '@/db/database';
import { createHabit } from '@/db/repositories/habits';
import { listReflectionsForDate, saveItemReflection } from '@/db/repositories/reflections';
import { listReviews, reviewedPeriods, saveReview } from '@/db/repositories/reviews';
import { createTask } from '@/db/repositories/tasks';
import { periodContaining } from '@/domain/review';
import { getRangeReport } from '@/services/analytics.service';
import { resetDatabase, setNow } from '../helpers/db';

const day = (date: string) => periodContaining('daily', date, 1);

beforeEach(async () => {
  await resetDatabase('UTC');
  setNow('2026-10-02T20:00:00Z'); // Friday
});

afterEach(() => {
  vi.useRealTimers();
});

describe('saving habit and task reflections', () => {
  it('keeps a separate reflection for each habit and task on each date', async () => {
    const run = await createHabit({ name: 'Run', frequency: 'daily' });
    const read = await createHabit({ name: 'Read', frequency: 'daily' });
    const task = await createTask({ title: 'Ship notes' });

    await saveItemReflection({ type: 'habit', id: run.id }, '2026-10-02', {
      rating: 5,
      wentWell: 'Easy pace',
    });
    await saveItemReflection({ type: 'habit', id: read.id }, '2026-10-02', {
      rating: 2,
      gotInTheWay: 'Too tired',
    });
    await saveItemReflection({ type: 'task', id: task.id }, '2026-10-02', { rating: 3 });
    await saveItemReflection({ type: 'habit', id: run.id }, '2026-10-01', { rating: 1 });

    expect(await db.itemReflections.count()).toBe(4);
    const friday = await listReflectionsForDate('2026-10-02');
    expect(
      friday
        .map(({ reflection, name }) => ({ name, rating: reflection.rating }))
        .sort((a, b) => (a.name ?? '').localeCompare(b.name ?? '')),
    ).toEqual([
      { name: 'Read', rating: 2 },
      { name: 'Run', rating: 5 },
      { name: 'Ship notes', rating: 3 },
    ]);
    expect((await listReflectionsForDate('2026-10-01'))[0]?.reflection.rating).toBe(1);
  });

  it('updates the same reflection on later saves', async () => {
    const habit = await createHabit({ name: 'Run', frequency: 'daily' });
    const subject = { type: 'habit', id: habit.id } as const;
    const first = await saveItemReflection(subject, '2026-10-02', { rating: 3 });
    setNow('2026-10-02T21:00:00Z');
    const second = await saveItemReflection(subject, '2026-10-02', {
      rating: 4,
      wentWell: 'Kept going',
    });

    expect(second?.id).toBe(first?.id);
    expect(second).toMatchObject({
      rating: 4,
      wentWell: 'Kept going',
      createdAt: first?.createdAt,
    });
    expect(await db.itemReflections.count()).toBe(1);
  });

  it('clears the reflection when saved empty', async () => {
    const habit = await createHabit({ name: 'Run', frequency: 'daily' });
    const subject = { type: 'habit', id: habit.id } as const;
    await saveItemReflection(subject, '2026-10-02', { rating: 3 });

    expect(await saveItemReflection(subject, '2026-10-02', { wentWell: '  ' })).toBeUndefined();
    expect(await db.itemReflections.count()).toBe(0);
  });

  it('rejects future dates and unknown habits or tasks', async () => {
    const habit = await createHabit({ name: 'Run', frequency: 'daily' });
    await expect(
      saveItemReflection({ type: 'habit', id: habit.id }, '2026-10-03', { rating: 3 }),
    ).rejects.toMatchObject({ kind: 'invalid_operation' });
    await expect(
      saveItemReflection({ type: 'task', id: habit.id }, '2026-10-02', { rating: 3 }),
    ).rejects.toMatchObject({ kind: 'not_found' });
    await expect(
      saveItemReflection({ type: 'habit', id: habit.id }, '2026-10-02', { rating: 6 }),
    ).rejects.toMatchObject({ kind: 'validation' });
  });
});

describe('reflections in reviews', () => {
  it('counts a day with only habit or task reflections as reviewed', async () => {
    const habit = await createHabit({ name: 'Run', frequency: 'daily' });
    const task = await createTask({ title: 'Ship notes' });
    await saveItemReflection({ type: 'habit', id: habit.id }, '2026-10-02', { rating: 4 });
    await saveItemReflection({ type: 'task', id: task.id }, '2026-10-02', { rating: 3 });
    await saveReview(day('2026-09-30'), { rating: 2 });

    const reviewed = await reviewedPeriods([day('2026-10-02'), day('2026-10-01')]);
    expect([...reviewed]).toEqual(['daily:2026-10-02']);
    expect(await listReviews(5)).toEqual([
      { period: day('2026-10-02'), rating: 3.5, reflections: 2 },
      { period: day('2026-09-30'), rating: 2, reflections: 0 },
    ]);
  });

  it('feeds item ratings and blockers into weekly reviews', async () => {
    const habit = await createHabit({ name: 'Run', frequency: 'daily' });
    const task = await createTask({ title: 'Ship notes' });
    // Thursday: two items, averaging 3. Friday: an older whole-day rating of 5.
    await saveItemReflection({ type: 'habit', id: habit.id }, '2026-10-01', {
      rating: 2,
      gotInTheWay: 'Late meeting',
    });
    await saveItemReflection({ type: 'task', id: task.id }, '2026-10-01', {
      rating: 4,
      gotInTheWay: 'Late meeting\n- Slack',
    });
    await saveReview(day('2026-10-02'), { rating: 5, blockers: 'Slack' });

    const { summary } = await getRangeReport('2026-09-28', '2026-10-04', '2026-10-02', 1, false);
    expect(summary.ratings).toEqual({ average: 4, count: 2 });
    expect(summary.blockers).toEqual([
      { text: 'Slack', dates: ['2026-10-01', '2026-10-02'] },
      { text: 'Late meeting', dates: ['2026-10-01'] },
    ]);
  });
});
