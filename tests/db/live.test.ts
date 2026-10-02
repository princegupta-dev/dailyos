import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { subscribeLive } from '@/db/live';
import { getDayPlan, listUnfinishedFromEarlier, planTask } from '@/db/repositories/plans';
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
});
