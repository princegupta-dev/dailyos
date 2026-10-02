import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createHabit, setHabitStatus } from '@/db/repositories/habits';
import { createLearningEntry } from '@/db/repositories/learning';
import { rescheduleTask, updatePlanDetails } from '@/db/repositories/plans';
import { saveReview } from '@/db/repositories/reviews';
import { completeTask, createTask, reopenTask, updateTask } from '@/db/repositories/tasks';
import { periodContaining } from '@/domain/review';
import { getDailySummary, getRangeReport, groupBlockers } from '@/services/analytics.service';
import { resetDatabase, setNow } from '../helpers/db';

const at = (date: string, time = '09:00') => {
  setNow(`${date}T${time}:00Z`);
};

beforeEach(async () => {
  await resetDatabase('UTC');
});

afterEach(() => {
  vi.useRealTimers();
});

describe('daily summary: plan versus actual', () => {
  it('compares planned work with what actually happened', async () => {
    at('2026-09-28'); // Monday
    const read = await createHabit({ name: 'Read', frequency: 'daily' });
    const gym = await createHabit({ name: 'Gym', frequency: 'selected_days', weekdays: [1] });
    await createHabit({ name: 'Weekly review', frequency: 'weekly' });

    const done = await createTask({ title: 'Write report' }, { planFor: '2026-09-28' });
    const moved = await createTask({ title: 'Call supplier' }, { planFor: '2026-09-28' });
    await createTask({ title: 'Clean inbox' }, { planFor: '2026-09-28' });
    const extra = await createTask({ title: 'Fix printer' });
    await updatePlanDetails('2026-09-28', {
      intention: 'Steady',
      topOutcomes: [
        { text: 'Report sent', done: true },
        { text: 'Inbox zero', done: false },
      ],
    });
    await createLearningEntry({ content: 'Batch similar calls', topic: 'Productivity' });

    at('2026-09-28', '15:00');
    await completeTask(done.id);
    await completeTask(extra.id);
    await rescheduleTask(moved.id, '2026-09-28', '2026-09-29', 'Supplier closed');
    await setHabitStatus(read.id, '2026-09-28', 'completed');
    await setHabitStatus(gym.id, '2026-09-28', 'skipped');

    at('2026-09-29');
    const summary = await getDailySummary('2026-09-28', '2026-09-29', 1);

    expect(summary.intention).toBe('Steady');
    expect(summary.outcomes.map((o) => o.done)).toEqual([true, false]);
    expect(summary.planned.map((p) => [p.title, p.outcome])).toEqual([
      ['Write report', 'done'],
      ['Call supplier', 'rescheduled'],
      ['Clean inbox', 'not_done'],
    ]);
    expect(summary.counts).toMatchObject({
      planned: 3,
      done: 1,
      notDone: 1,
      rescheduled: 1,
      completionRate: 0.5,
    });
    expect(summary.unplannedCompleted.map((t) => t.title)).toEqual(['Fix printer']);
    expect(summary.habits.map((h) => [h.name, h.status])).toEqual([
      ['Read', 'completed'],
      ['Gym', 'skipped'],
      ['Weekly review', 'pending'],
    ]);
    expect(summary.habitSummary).toMatchObject({ completed: 1, skipped: 1, pending: 1, rate: 1 });
    expect(summary.learning.map((l) => l.topic)).toEqual(['Productivity']);
  });

  it('keeps past summaries unchanged when tasks are edited or reopened later', async () => {
    at('2026-09-28');
    const task = await createTask({ title: 'Original' }, { planFor: '2026-09-28' });
    at('2026-09-28', '16:00');
    await completeTask(task.id);

    at('2026-10-02');
    await updateTask(task.id, { title: 'Renamed' });
    await reopenTask(task.id);

    const summary = await getDailySummary('2026-09-28', '2026-10-02', 1);
    expect(summary.planned).toEqual([{ taskId: task.id, title: 'Original', outcome: 'done' }]);
  });
});

describe('weekly and monthly summaries', () => {
  it('aggregates task completion, habit consistency, topics, ratings, and blockers for a week', async () => {
    at('2026-09-28');
    const habit = await createHabit({ name: 'Read', frequency: 'daily' });
    const a = await createTask({ title: 'A' }, { planFor: '2026-09-28' });
    const b = await createTask({ title: 'B' }, { planFor: '2026-09-29' });
    const c = await createTask({ title: 'C' });
    await createLearningEntry({ content: 'x', topic: 'TypeScript' });
    await createLearningEntry({ content: 'y', topic: 'typescript' });
    await createLearningEntry({ content: 'z', topic: 'Leadership' });

    at('2026-09-28', '12:00');
    await completeTask(a.id);
    await setHabitStatus(habit.id, '2026-09-28', 'completed');
    await saveReview(periodContaining('daily', '2026-09-28', 1), {
      rating: 4,
      blockers: '- Meetings ran long\nSlack',
    });

    at('2026-09-29', '12:00');
    await completeTask(c.id);
    await setHabitStatus(habit.id, '2026-09-29', 'skipped');
    at('2026-09-29', '13:00');
    await reopenTask(c.id); // reopened within the week: not counted as completed
    await saveReview(periodContaining('daily', '2026-09-29', 1), {
      rating: 2,
      blockers: 'meetings ran long.',
    });

    at('2026-09-30', '12:00');
    await rescheduleTask(b.id, '2026-09-29', '2026-09-30', 'Waiting on review');
    // Sep 30 habit: no entry → missed once the day is over.

    at('2026-10-05'); // the following Monday
    const { summary, weeks } = await getRangeReport(
      '2026-09-28',
      '2026-10-04',
      '2026-10-05',
      1,
      false,
    );

    expect(weeks).toBeUndefined();
    expect(summary.tasksCompleted).toBe(1);
    // A done; B rescheduled from Sep 29 (neutral) and not done on Sep 30.
    expect(summary.plan).toMatchObject({
      planned: 3,
      done: 1,
      notDone: 1,
      rescheduled: 1,
      completionRate: 0.5,
    });
    expect(summary.habits.perHabit[0]?.summary).toMatchObject({
      completed: 1,
      skipped: 1,
      missed: 5,
    });
    expect(summary.learning).toEqual({
      count: 3,
      topics: [
        { topic: 'TypeScript', count: 2 },
        { topic: 'Leadership', count: 1 },
      ],
    });
    expect(summary.ratings).toEqual({ average: 3, count: 2 });
    expect(summary.blockers).toEqual([
      { text: 'Meetings ran long', dates: ['2026-09-28', '2026-09-29'] },
      { text: 'Waiting on review', dates: ['2026-09-30'] },
      { text: 'Slack', dates: ['2026-09-28'] },
    ]);
  });

  it('breaks a month into weeks clipped to the month whose totals add up', async () => {
    at('2026-09-01');
    const tasks = [];
    for (const day of ['2026-09-01', '2026-09-10', '2026-09-30']) {
      at(day);
      tasks.push(await createTask({ title: day }, { planFor: day }));
      at(day, '18:00');
      await completeTask(tasks.at(-1)!.id);
    }
    at('2026-10-01');
    await completeTask((await createTask({ title: 'October' })).id);

    const { summary, weeks } = await getRangeReport(
      '2026-09-01',
      '2026-09-30',
      '2026-10-02',
      1,
      true,
    );
    expect(summary.tasksCompleted).toBe(3);
    expect(weeks?.[0]).toMatchObject({ from: '2026-09-01', to: '2026-09-06' });
    expect(weeks?.at(-1)).toMatchObject({ from: '2026-09-28', to: '2026-09-30' });
    expect(weeks?.reduce((sum, w) => sum + w.tasksCompleted, 0)).toBe(3);
  });
});

describe('blocker grouping', () => {
  it('merges lines that differ only by case, accents, bullets, or punctuation', () => {
    expect(
      groupBlockers([
        { date: '2026-09-01', text: '1. Café too loud!' },
        { date: '2026-09-02', text: 'cafe too loud' },
        { date: '2026-09-02', text: '   ' },
      ]),
    ).toEqual([{ text: 'Café too loud!', dates: ['2026-09-01', '2026-09-02'] }]);
  });
});
