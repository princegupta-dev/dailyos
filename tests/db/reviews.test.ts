import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '@/db/database';
import {
  convertActionToTask,
  getReviewForPeriod,
  listOpenActions,
  listReviews,
  reviewedPeriods,
  saveReview,
  setActionStatus,
} from '@/db/repositories/reviews';
import { getTaskEvents } from '@/db/repositories/tasks';
import { periodContaining } from '@/domain/review';
import { resetDatabase, setNow } from '../helpers/db';

const day = (date: string) => periodContaining('daily', date, 1);
const week = (date: string) => periodContaining('weekly', date, 1);

beforeEach(async () => {
  await resetDatabase();
  setNow('2026-10-02T20:00:00Z');
});

afterEach(() => {
  vi.useRealTimers();
});

describe('saving reviews', () => {
  it('creates once per period and updates on later saves', async () => {
    const first = await saveReview(day('2026-10-02'), { wins: 'Shipped', rating: 4 });
    setNow('2026-10-02T21:00:00Z');
    const second = await saveReview(day('2026-10-02'), { wins: 'Shipped v2', rating: 5 });

    expect(second.id).toBe(first.id);
    expect(second).toMatchObject({ wins: 'Shipped v2', rating: 5, createdAt: first.createdAt });
    expect(await db.reviews.count()).toBe(1);
    expect(
      (await reviewedPeriods([day('2026-10-02'), day('2026-10-01')])).has('daily:2026-10-02'),
    ).toBe(true);
  });

  it('allows the same start date for different period types', async () => {
    await saveReview(periodContaining('weekly', '2026-09-28', 1), {});
    await saveReview(day('2026-09-28'), {});
    expect(await db.reviews.count()).toBe(2);
  });

  it('the database rejects a duplicate review for the same period', async () => {
    const review = await saveReview(day('2026-10-02'), {});
    await expect(
      db.reviews.add({ ...review, id: '6c7d8e9f-0a1b-4c2d-8e3f-405162738495' }),
    ).rejects.toMatchObject({
      name: 'ConstraintError',
    });
  });

  it('refuses periods that have not started and clears a removed rating', async () => {
    await expect(saveReview(day('2026-10-03'), {})).rejects.toMatchObject({
      kind: 'invalid_operation',
    });
    await saveReview(day('2026-10-02'), { rating: 3 });
    const cleared = await saveReview(day('2026-10-02'), {});
    expect(cleared).not.toHaveProperty('rating');
  });
});

describe('review actions', () => {
  it('syncs actions: adds new, updates existing, removes deleted', async () => {
    await saveReview(day('2026-10-02'), {
      actions: [{ title: 'Book flights' }, { title: 'Email Sam' }],
    });
    const { actions } = await getReviewForPeriod('daily', '2026-10-02');
    const [flights] = actions;

    await saveReview(day('2026-10-02'), {
      actions: [{ id: flights!.id, title: 'Book flights', status: 'done' }, { title: 'Plan trip' }],
    });
    const after = await getReviewForPeriod('daily', '2026-10-02');
    expect(after.actions.map((a) => [a.title, a.status])).toEqual([
      ['Book flights', 'done'],
      ['Plan trip', 'open'],
    ]);
    expect(after.actions[0]?.completedAt).toBeDefined();
  });

  it('carries open actions forward into later periods until done', async () => {
    await saveReview(day('2026-10-01'), {
      actions: [{ title: 'Renew passport', targetDate: '2026-10-10' }],
    });
    await saveReview(day('2026-10-02'), { actions: [{ title: 'Today item' }] });

    const earlier = await listOpenActions('2026-10-02');
    expect(earlier.map((o) => o.action.title)).toEqual(['Renew passport']);
    expect((await listOpenActions()).map((o) => o.action.title)).toEqual([
      'Renew passport',
      'Today item',
    ]);

    await setActionStatus(earlier[0]!.action.id, 'done');
    expect(await listOpenActions('2026-10-02')).toEqual([]);
  });

  it('turns an action into a linked inbox task exactly once', async () => {
    await saveReview(week('2026-10-02'), {
      actions: [{ title: 'Draft OKRs', targetDate: '2026-10-09' }],
    });
    const [action] = (await getReviewForPeriod('weekly', '2026-09-28')).actions;
    const task = await convertActionToTask(action!.id);
    const again = await convertActionToTask(action!.id);

    expect(again.id).toBe(task.id);
    expect(task).toMatchObject({ title: 'Draft OKRs', status: 'inbox', dueDate: '2026-10-09' });
    expect(await db.tasks.count()).toBe(1);
    expect((await getTaskEvents(task.id))[0]?.note).toBe('From a review action');
    expect((await getReviewForPeriod('weekly', '2026-09-28')).actions[0]?.taskId).toBe(task.id);
  });

  it('lists past reviews newest first', async () => {
    await saveReview(day('2026-09-30'), {});
    await saveReview(day('2026-10-02'), {});
    expect((await listReviews(5)).map((r) => r.periodStart)).toEqual(['2026-10-02', '2026-09-30']);
  });
});
