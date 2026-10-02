import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getDayPlan,
  listUnfinishedFromEarlier,
  planTask,
  rescheduleTask,
  unplanTask,
} from '@/db/repositories/plans';
import {
  completeTask,
  createTask,
  getTask,
  getTaskEvents,
  getTaskPlanHistory,
  reopenTask,
  updateTask,
} from '@/db/repositories/tasks';
import { toLocalDateKey } from '@/lib/dates';
import { resetDatabase, setNow } from '../helpers/db';

/** Day plan as seen at the (frozen) current time. */
const dayPlan = (date: string) => getDayPlan(date, toLocalDateKey(new Date(), 'UTC'));

beforeEach(async () => {
  await resetDatabase();
  setNow('2026-10-02T09:00:00Z');
});

afterEach(() => {
  vi.useRealTimers();
});

describe('planning', () => {
  it('plans an inbox task for today, moving it to "to do" with snapshots', async () => {
    const task = await createTask({
      title: 'Read chapter 3',
      estimatedMinutes: 45,
      priority: 'high',
    });
    await planTask(task.id, '2026-10-02');

    expect((await getTask(task.id))?.status).toBe('todo');
    const day = await dayPlan('2026-10-02');
    expect(day.plan?.date).toBe('2026-10-02');
    expect(day.plan?.timezone).toBe('UTC');
    expect(day.entries).toHaveLength(1);
    expect(day.entries[0]?.item).toMatchObject({
      titleSnapshot: 'Read chapter 3',
      prioritySnapshot: 'high',
      plannedMinutes: 45,
      position: 0,
    });
    expect(day.entries[0]?.outcome).toBe('open');
  });

  it('is idempotent for the same task and day', async () => {
    const task = await createTask({ title: 'Once' });
    await planTask(task.id, '2026-10-02');
    await planTask(task.id, '2026-10-02');
    expect((await dayPlan('2026-10-02')).entries).toHaveLength(1);
  });

  it('refuses to change past plans', async () => {
    const task = await createTask({ title: 'Late' });
    await expect(planTask(task.id, '2026-10-01')).rejects.toMatchObject({
      kind: 'invalid_operation',
    });
    await expect(unplanTask(task.id, '2026-10-01')).rejects.toMatchObject({
      kind: 'invalid_operation',
    });
  });

  it('unplanning keeps the item as removed history', async () => {
    const task = await createTask({ title: 'Changed my mind' });
    await planTask(task.id, '2026-10-02');
    await unplanTask(task.id, '2026-10-02');

    expect((await dayPlan('2026-10-02')).entries).toHaveLength(0);
    const history = await getTaskPlanHistory(task.id);
    expect(history).toHaveLength(1);
    expect(history[0]?.removedAt).toBeDefined();
  });

  it('refuses to plan finished tasks', async () => {
    const task = await createTask({ title: 'Already done' });
    await completeTask(task.id);
    await expect(planTask(task.id, '2026-10-02')).rejects.toMatchObject({
      kind: 'invalid_operation',
    });
  });
});

describe('historical integrity', () => {
  it('keeps the original plan unchanged when a task is rescheduled', async () => {
    const task = await createTask({ title: 'Write report' }, { planFor: '2026-10-02' });
    setNow('2026-10-02T18:00:00Z');
    await rescheduleTask(task.id, '2026-10-02', '2026-10-04', 'Blocked on data');

    const original = await dayPlan('2026-10-02');
    expect(original.entries).toHaveLength(1);
    expect(original.entries[0]?.item.rescheduledTo).toBe('2026-10-04');
    expect(original.entries[0]?.outcome).toBe('rescheduled');

    const target = await dayPlan('2026-10-04');
    expect(target.entries.map((e) => e.task.id)).toEqual([task.id]);

    const events = await getTaskEvents(task.id);
    expect(events.at(-1)).toMatchObject({
      type: 'rescheduled',
      fromDate: '2026-10-02',
      toDate: '2026-10-04',
      note: 'Blocked on data',
    });
  });

  it('keeps the snapshot title when the task is edited later', async () => {
    const task = await createTask({ title: 'Original title' }, { planFor: '2026-10-02' });
    setNow('2026-10-03T09:00:00Z');
    await updateTask(task.id, { title: 'Renamed' });

    const day = await dayPlan('2026-10-02');
    expect(day.entries[0]?.item.titleSnapshot).toBe('Original title');
    expect(day.entries[0]?.task.title).toBe('Renamed');
  });

  it('derives outcomes from history, not the current status', async () => {
    const task = await createTask({ title: 'Done then reopened' }, { planFor: '2026-10-02' });
    setNow('2026-10-02T16:00:00Z');
    await completeTask(task.id);
    setNow('2026-10-05T09:00:00Z');
    await reopenTask(task.id);

    // Reopening on Oct 5 must not change the Oct 2 result.
    expect((await dayPlan('2026-10-02')).entries[0]?.outcome).toBe('done');
  });

  it('marks past planned items that were never finished as not done', async () => {
    const task = await createTask({ title: 'Slipped' }, { planFor: '2026-10-02' });
    setNow('2026-10-03T09:00:00Z');
    expect((await dayPlan('2026-10-02')).entries[0]?.outcome).toBe('not_done');
    expect(await listUnfinishedFromEarlier('2026-10-03')).toEqual([
      { task: expect.objectContaining({ id: task.id }) as unknown, lastPlannedFor: '2026-10-02' },
    ]);
  });
});

describe('unfinished work', () => {
  it('lists slipped tasks without moving them, and drops them once replanned', async () => {
    const slipped = await createTask({ title: 'Slipped' }, { planFor: '2026-10-02' });
    const finished = await createTask({ title: 'Finished' }, { planFor: '2026-10-02' });
    await completeTask(finished.id);

    setNow('2026-10-03T09:00:00Z');
    const unfinished = await listUnfinishedFromEarlier('2026-10-03');
    expect(unfinished.map((u) => u.task.id)).toEqual([slipped.id]);
    expect((await dayPlan('2026-10-03')).entries).toHaveLength(0);

    await rescheduleTask(slipped.id, '2026-10-02', '2026-10-03');
    expect(await listUnfinishedFromEarlier('2026-10-03')).toEqual([]);
    expect((await dayPlan('2026-10-02')).entries[0]?.outcome).toBe('rescheduled');
  });

  it('rejects rescheduling into the past', async () => {
    const task = await createTask({ title: 'x' }, { planFor: '2026-10-02' });
    await expect(rescheduleTask(task.id, '2026-10-02', '2026-09-30')).rejects.toMatchObject({
      kind: 'invalid_operation',
    });
  });
});
