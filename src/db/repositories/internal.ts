import type { z } from 'zod';
import type { DailyPlan, PlanItem } from '@/domain/plan';
import { taskEventSchema, type Task, type TaskEvent } from '@/domain/task';
import { toLocalDateKey } from '@/lib/dates';
import { newId } from '@/lib/ids';
import { toValidationIssues } from '@/lib/validation';
import { db } from '../database';
import { AppError, toAppError } from '../errors';
import { getActiveTimeZone } from './settings';

/** Moment and local calendar context shared by every write in one operation. */
export interface WriteContext {
  now: string;
  timeZone: string;
  today: string;
}

export async function writeContext(): Promise<WriteContext> {
  const timeZone = await getActiveTimeZone();
  const now = new Date();
  return { now: now.toISOString(), timeZone, today: toLocalDateKey(now, timeZone) };
}

/** Runs a repository operation and normalizes any failure into an AppError. */
export async function guard<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    throw toAppError(error);
  }
}

export function parseInput<S extends z.ZodType>(schema: S, value: unknown): z.output<S> {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw new AppError('validation', 'Some fields need attention.', {
      issues: toValidationIssues(result.error),
      cause: result.error,
    });
  }
  return result.data;
}

/** Removes keys whose value is `undefined`, so optional fields are absent rather than undefined. */
export function compact<T extends object>(value: T): T {
  return Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined)) as T;
}

export function notFound(entity: string): AppError {
  return new AppError('not_found', `${entity} not found. It may have been removed in another tab.`);
}

export async function requireTask(id: string): Promise<Task> {
  const task = await db.tasks.get(id);
  if (!task) throw notFound('Task');
  return task;
}

export function buildEvent(
  ctx: WriteContext,
  taskId: string,
  type: TaskEvent['type'],
  details: Partial<Omit<TaskEvent, 'id' | 'taskId' | 'type' | 'occurredAt' | 'localDate'>> = {},
): TaskEvent {
  return compact(
    taskEventSchema.parse({
      id: newId(),
      taskId,
      type,
      occurredAt: ctx.now,
      localDate: ctx.today,
      ...details,
    }),
  );
}

/** Returns the plan for `date`, creating an empty one if needed. Call inside a transaction. */
export async function ensurePlan(ctx: WriteContext, date: string): Promise<DailyPlan> {
  const existing = await db.dailyPlans.where('date').equals(date).first();
  if (existing) return existing;
  const plan: DailyPlan = {
    id: newId(),
    date,
    timezone: ctx.timeZone,
    intention: '',
    topOutcomes: [],
    createdAt: ctx.now,
    updatedAt: ctx.now,
  };
  await db.dailyPlans.add(plan);
  return plan;
}

export async function activeItemFor(taskId: string, date: string): Promise<PlanItem | undefined> {
  const items = await db.planItems.where('[taskId+date]').equals([taskId, date]).toArray();
  return items.find((item) => item.removedAt === undefined);
}

/** Adds `task` to the plan for `date` with a frozen snapshot. Call inside a transaction. */
export async function addPlanItem(ctx: WriteContext, task: Task, date: string): Promise<PlanItem> {
  const plan = await ensurePlan(ctx, date);
  const position = await db.planItems.where('planId').equals(plan.id).count();
  const item: PlanItem = compact({
    id: newId(),
    planId: plan.id,
    taskId: task.id,
    date,
    position,
    plannedMinutes: task.estimatedMinutes,
    titleSnapshot: task.title,
    prioritySnapshot: task.priority,
    addedAt: ctx.now,
  });
  await db.planItems.add(item);
  return item;
}
