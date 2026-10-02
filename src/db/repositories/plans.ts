import {
  dailyPlanSchema,
  derivePlanItemOutcome,
  type DailyPlan,
  type PlanItem,
  type PlanItemOutcome,
} from '@/domain/plan';
import { groupBy } from '@/lib/collections';
import { addDays } from '@/lib/dates';
import { newId } from '@/lib/ids';
import { isOpen, type Task } from '@/domain/task';
import { db } from '../database';
import { AppError } from '../errors';
import {
  activeItemFor,
  addPlanItem,
  buildEvent,
  ensurePlan,
  guard,
  parseInput,
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
  const events = groupBy(eventList, (e) => e.taskId);

  const entries = items.flatMap((item) => {
    const task = tasks.get(item.taskId);
    if (!task) return [];
    const outcome = derivePlanItemOutcome(item, events.get(item.taskId) ?? [], today);
    return [{ item, task, outcome }];
  });
  return plan ? { date, plan, entries } : { date, entries };
}

export interface PlanDetailsPatch {
  intention?: string;
  /** Outcomes in order; blank ones are dropped. New outcomes may omit `id`. */
  topOutcomes?: { id?: string | undefined; text: string; done: boolean }[];
}

/**
 * Sets the intention and top outcomes for a day, creating the plan if needed. Today and future
 * plans are editable, and yesterday's too so a late-night review can still tick outcomes off;
 * anything older is history.
 */
export async function updatePlanDetails(date: string, patch: PlanDetailsPatch): Promise<DailyPlan> {
  return guard(async () => {
    const ctx = await writeContext();
    if (date < addDays(ctx.today, -1)) {
      throw new AppError('invalid_operation', 'Past plans are history and can’t be changed.');
    }
    return db.transaction('rw', db.dailyPlans, async () => {
      const plan = await ensurePlan(ctx, date);
      const next = { ...plan, updatedAt: ctx.now };
      if (patch.intention !== undefined) next.intention = patch.intention;
      if (patch.topOutcomes !== undefined) {
        next.topOutcomes = patch.topOutcomes
          .filter((o) => o.text.trim() !== '')
          .map((o) => ({ id: o.id ?? newId(), text: o.text, done: o.done }));
      }
      const validated = parseInput(dailyPlanSchema, next);
      await db.dailyPlans.put(validated);
      return validated;
    });
  });
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
