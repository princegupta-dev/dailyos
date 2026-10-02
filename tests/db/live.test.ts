import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { subscribeLive } from '@/db/live';
import { getReviewForPeriod, listOpenActions, saveReview } from '@/db/repositories/reviews';
import { periodContaining } from '@/domain/review';
import { getDailySummary, getRangeReport } from '@/services/analytics.service';
import {
  createLearningEntry,
  getLearningDetail,
  listDueReviews,
  listRecentLearning,
  searchLearning,
  setReviewDone,
} from '@/db/repositories/learning';
import {
  createHabit,
  getHabitDetail,
  getHabitsForDay,
  listHabits,
  setHabitStatus,
} from '@/db/repositories/habits';
import {
  getDayPlan,
  getPlan,
  listUnfinishedFromEarlier,
  planTask,
  updatePlanDetails,
} from '@/db/repositories/plans';
import { getSettings, updateSettings } from '@/db/repositories/settings';
import {
  completeTask,
  createTask,
  getTaskDetail,
  listOpenTasks,
  listTasks,
} from '@/db/repositories/tasks';
import { toLocalDateKey } from '@/lib/dates';
import { resetDatabase } from '../helpers/db';

/**
 * Guards against a subtle Dexie pitfall: a read that loses its async context stops
 * re-running after writes, and the UI silently shows stale data. Every read used with
 * useLiveData should appear here.
 */

const unsubscribers: (() => void)[] = [];

function observe<T>(query: () => Promise<T>) {
  const values: T[] = [];
  unsubscribers.push(
    subscribeLive(
      query,
      (v) => values.push(v),
      (e: unknown) => {
        throw e;
      },
    ),
  );
  return values;
}

async function until(condition: () => boolean, timeout = 2000) {
  const start = Date.now();
  while (!condition()) {
    if (Date.now() - start > timeout) throw new Error('Timed out waiting for live query');
    await new Promise((r) => setTimeout(r, 10));
  }
}

const today = () => toLocalDateKey(new Date(), 'UTC');

beforeEach(async () => {
  await resetDatabase();
});

afterEach(() => {
  unsubscribers.splice(0).forEach((u) => {
    u();
  });
});

describe('live queries re-run after writes', () => {
  it('getDayPlan', async () => {
    const values = observe(() => getDayPlan(today(), today()));
    await until(() => values.length === 1);
    await createTask({ title: 'x' }, { planFor: today() });
    await until(() => values.at(-1)?.entries.length === 1);
    expect(values.at(-1)?.entries[0]?.item.titleSnapshot).toBe('x');
  });

  it('listTasks and listOpenTasks', async () => {
    const inbox = observe(() => listTasks('inbox'));
    const open = observe(listOpenTasks);
    await until(() => inbox.length === 1 && open.length === 1);
    const task = await createTask({ title: 'x' });
    await until(() => inbox.at(-1)?.length === 1 && open.at(-1)?.length === 1);
    await completeTask(task.id);
    await until(() => inbox.at(-1)?.length === 0 && open.at(-1)?.length === 0);
  });

  it('getTaskDetail', async () => {
    const task = await createTask({ title: 'x' });
    const values = observe(() => getTaskDetail(task.id));
    await until(() => values.length === 1);
    await planTask(task.id, today());
    await until(() => values.at(-1)?.planItems.length === 1);
    expect(values.at(-1)?.events.map((e) => e.type)).toEqual(['created', 'planned']);
  });

  it('listUnfinishedFromEarlier', async () => {
    const tomorrow = toLocalDateKey(new Date(Date.now() + 86_400_000), 'UTC');
    const values = observe(() => listUnfinishedFromEarlier(tomorrow));
    await until(() => values.length === 1);
    await createTask({ title: 'x' }, { planFor: today() });
    await until(() => values.at(-1)?.length === 1);
  });

  it('getSettings', async () => {
    const values = observe(getSettings);
    await until(() => values.length === 1);
    await updateSettings({ weekStartsOn: 0 });
    await until(() => values.at(-1)?.weekStartsOn === 0);
  });

  it('getPlan', async () => {
    const values = observe(() => getPlan(today()));
    await until(() => values.length === 1);
    await updatePlanDetails(today(), { intention: 'Focus' });
    await until(() => values.at(-1)?.intention === 'Focus');
  });

  it('habit reads', async () => {
    const list = observe(() => listHabits());
    const day = observe(() => getHabitsForDay(today(), today(), 1));
    await until(() => list.length === 1 && day.length === 1);
    const habit = await createHabit({ name: 'Read', frequency: 'daily' });
    await until(() => list.at(-1)?.length === 1 && day.at(-1)?.length === 1);
    const detail = observe(() => getHabitDetail(habit.id));
    await until(() => detail.length === 1);
    await setHabitStatus(habit.id, today(), 'completed');
    await until(
      () =>
        day.at(-1)?.[0]?.occurrence.status === 'completed' && detail.at(-1)?.entries.length === 1,
    );
  });

  it('learning reads', async () => {
    const search = observe(() => searchLearning({ text: 'dexie' }));
    const recent = observe(() => listRecentLearning(3));
    const due = observe(() => listDueReviews(today()));
    await until(() => search.length === 1 && recent.length === 1 && due.length === 1);
    const entry = await createLearningEntry({ content: 'Dexie tip', reviewDates: [today()] });
    await until(
      () =>
        search.at(-1)?.entries.length === 1 &&
        recent.at(-1)?.length === 1 &&
        due.at(-1)?.length === 1,
    );
    const detail = observe(() => getLearningDetail(entry.id));
    await until(() => detail.length === 1);
    await setReviewDone(entry.id, today(), true);
    await until(
      () =>
        due.at(-1)?.length === 0 && detail.at(-1)?.entry.reviewDates[0]?.completedAt !== undefined,
    );
  });

  it('review reads and summaries', async () => {
    const period = periodContaining('daily', today(), 1);
    const review = observe(() => getReviewForPeriod('daily', today()));
    const open = observe(() => listOpenActions());
    const daily = observe(() => getDailySummary(today(), today(), 1));
    const range = observe(() => getRangeReport(today(), today(), today(), 1, true));
    await until(
      () => review.length === 1 && open.length === 1 && daily.length === 1 && range.length === 1,
    );

    await saveReview(period, { wins: 'x', actions: [{ title: 'Follow up' }] });
    await until(() => review.at(-1)?.review?.wins === 'x' && open.at(-1)?.length === 1);

    await createTask({ title: 'Planned' }, { planFor: today() });
    await until(
      () => daily.at(-1)?.counts.planned === 1 && range.at(-1)?.summary.plan.planned === 1,
    );
  });
});
