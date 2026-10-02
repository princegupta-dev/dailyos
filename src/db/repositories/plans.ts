import {
  derivePlanItemOutcome,
  type DailyPlan,
  type PlanItem,
  type PlanItemOutcome,
} from '@/domain/plan';
import { isOpen, type Task, type TaskEvent } from '@/domain/task';
import { db } from '../database';
import { AppError } from '../errors';
import {
  activeItemFor,
  addPlanItem,
  buildEvent,
  guard,
  requireTask,
  writeContext,
} from './internal';
import { latestPlannedDates } from './tasks';

const PLAN_TABLES = () => [db.tasks, db.taskEvents, db.dailyPlans, db.planItems];

export function getPlan(date: string): Promise<DailyPlan | undefined> {
  return db.dailyPlans.where('date').equals(date).first();
}

export interface DayPlanEntry {
  item: PlanItem;
  task: Task;
  outcome: PlanItemOutcome;
}

export interface DayPlan {
  date: string;
  plan?: DailyPlan;
  entries: DayPlanEntry[];
}

/** Groups events by task id. */
export function eventsByTask(events: readonly TaskEvent[]): Map<string, TaskEvent[]> {
  const grouped = new Map<string, TaskEvent[]>();
  for (const event of events) {
    const list = grouped.get(event.taskId);
    if (list) list.push(event);
    else grouped.set(event.taskId, [event]);
  }
  return grouped;
}

/**
 * The plan for `date` with each planned item's task and derived outcome. `today` decides
 * whether an unfinished item is still open or was not done. Reads call Dexie directly so
 * live queries track them (see the note in tasks.ts).
 */
export async function getDayPlan(date: string, today: string): Promise<DayPlan> {
  const plan = await db.dailyPlans.where('date').equals(date).first();
  const items = (await db.planItems.where('date').equals(date).toArray())
    .filter((item) => item.removedAt === undefined)
    .sort((a, b) => a.position - b.position);

  const taskIds = items.map((item) => item.taskId);
  const taskList = await db.tasks.bulkGet(taskIds);
  const eventList = await db.taskEvents.where('taskId').anyOf(taskIds).toArray();
  const tasks = new Map(taskList.flatMap((t) => (t ? [[t.id, t] as const] : [])));
  const events = eventsByTask(eventList);

  const entries = items.flatMap((item) => {
    const task = tasks.get(item.taskId);
    if (!task) return [];
    const outcome = derivePlanItemOutcome(item, events.get(item.taskId) ?? [], today);
    return [{ item, task, outcome }];
  });
  return plan ? { date, plan, entries } : { date, entries };
}

/** Places an open task on `date`'s plan. Planning an inbox task moves it to "to do". */
export async function planTask(taskId: string, date: string): Promise<void> {
  return guard(async () => {
    const ctx = await writeContext();
    if (date < ctx.today) {
      throw new AppError('invalid_operation', 'Past plans are history and can’t be changed.');
    }
    await db.transaction('rw', PLAN_TABLES(), async () => {
      const task = await requireTask(taskId);
      if (!isOpen(task) || task.archivedAt !== undefined) {
        throw new AppError('invalid_operation', 'Only open tasks can be planned.');
      }
      if (await activeItemFor(taskId, date)) return;

      await addPlanItem(ctx, task, date);
      if (task.status === 'inbox') {
        await db.tasks.put({ ...task, status: 'todo', updatedAt: ctx.now });
        await db.taskEvents.add(
          buildEvent(ctx, taskId, 'planned', {
            toDate: date,
            fromStatus: 'inbox',
            toStatus: 'todo',
          }),
        );
      } else {
        await db.taskEvents.add(buildEvent(ctx, taskId, 'planned', { toDate: date }));
      }
    });
  });
}

/** Removes a task from today's or a future plan. The item is kept, marked as removed. */
export async function unplanTask(taskId: string, date: string): Promise<void> {
  return guard(async () => {
    const ctx = await writeContext();
    if (date < ctx.today) {
      throw new AppError('invalid_operation', 'Past plans are history and can’t be changed.');
    }
    await db.transaction('rw', PLAN_TABLES(), async () => {
      const item = await activeItemFor(taskId, date);
      if (!item) return;
      await db.planItems.put({ ...item, removedAt: ctx.now });
      await db.taskEvents.add(buildEvent(ctx, taskId, 'unplanned', { fromDate: date }));
    });
  });
}

/**
 * Moves an open task from one day's plan to another. The original item stays on its day,
 * marked `rescheduledTo`, so the original plan remains visible in history and reviews.
 */
export async function rescheduleTask(
  taskId: string,
  fromDate: string,
  toDate: string,
  note?: string,
): Promise<void> {
  return guard(async () => {
    const ctx = await writeContext();
    if (toDate < ctx.today) {
      throw new AppError('invalid_operation', 'Choose today or a future date.');
    }
    if (toDate === fromDate) return;
    await db.transaction('rw', PLAN_TABLES(), async () => {
      const task = await requireTask(taskId);
      if (!isOpen(task)) {
        throw new AppError('invalid_operation', 'Only open tasks can be rescheduled.');
      }
      const original = await activeItemFor(taskId, fromDate);
      if (!original || original.rescheduledTo !== undefined) {
        throw new AppError('invalid_operation', 'This task is not planned for that day.');
      }
      await db.planItems.put({ ...original, rescheduledTo: toDate });
      if (!(await activeItemFor(taskId, toDate))) {
        await addPlanItem(ctx, task, toDate);
      }
      await db.taskEvents.add(buildEvent(ctx, taskId, 'rescheduled', { fromDate, toDate, note }));
    });
  });
}

export interface UnfinishedTask {
  task: Task;
  lastPlannedFor: string;
}

/**
 * Open tasks whose most recent plan is before `today` — work that slipped. These are shown,
 * never moved automatically; the person decides whether to reschedule them.
 */
export async function listUnfinishedFromEarlier(today: string): Promise<UnfinishedTask[]> {
  const open = (await db.tasks.toArray()).filter((t) => isOpen(t) && t.archivedAt === undefined);
  const items = await db.planItems
    .where('taskId')
    .anyOf(open.map((t) => t.id))
    .toArray();
  const latest = latestPlannedDates(items);
  return open
    .flatMap((task) => {
      const lastPlannedFor = latest.get(task.id);
      return lastPlannedFor !== undefined && lastPlannedFor < today
        ? [{ task, lastPlannedFor }]
        : [];
    })
    .sort((a, b) => a.lastPlannedFor.localeCompare(b.lastPlannedFor));
}
