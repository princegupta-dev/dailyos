import {
  canTransition,
  compareEvents,
  OPEN_STATUSES,
  STATUS_LABELS,
  taskDraftSchema,
  TRANSITIONS,
  type Task,
  type TaskDraft,
  type TaskEvent,
  type TaskPriority,
  type TaskTransition,
} from '@/domain/task';
import type { PlanItem } from '@/domain/plan';
import { newId } from '@/lib/ids';
import { db } from '../database';
import { AppError } from '../errors';
import {
  addPlanItem,
  buildEvent,
  compact,
  guard,
  parseInput,
  requireTask,
  writeContext,
} from './internal';

const TASK_TABLES = () => [db.tasks, db.taskEvents, db.dailyPlans, db.planItems];

export interface CreateTaskOptions {
  /** Also place the new task on this day's plan. */
  planFor?: string;
}

export async function createTask(draft: TaskDraft, options: CreateTaskOptions = {}): Promise<Task> {
  const fields = parseInput(taskDraftSchema, draft);
  return guard(async () => {
    const ctx = await writeContext();
    const task: Task = compact({
      id: newId(),
      ...fields,
      status: options.planFor ? 'todo' : 'inbox',
      createdAt: ctx.now,
      updatedAt: ctx.now,
    });
    await db.transaction('rw', TASK_TABLES(), async () => {
      await db.tasks.add(task);
      await db.taskEvents.add(buildEvent(ctx, task.id, 'created', { toStatus: task.status }));
      if (options.planFor) {
        await addPlanItem(ctx, task, options.planFor);
        await db.taskEvents.add(buildEvent(ctx, task.id, 'planned', { toDate: options.planFor }));
      }
    });
    return task;
  });
}

const EDITABLE_FIELDS = [
  'title',
  'description',
  'priority',
  'dueDate',
  'estimatedMinutes',
] as const;

/**
 * Updates editable fields. A key present with `undefined` clears that optional field.
 * Records an `edited` event listing the changed fields; a no-op edit records nothing.
 */
export async function updateTask(id: string, patch: Partial<TaskDraft>): Promise<Task> {
  return guard(async () => {
    const ctx = await writeContext();
    return db.transaction('rw', db.tasks, db.taskEvents, async () => {
      const task = await requireTask(id);
      const merged: Record<string, unknown> = {};
      for (const field of EDITABLE_FIELDS) {
        merged[field] = field in patch ? patch[field] : task[field];
      }
      const fields = parseInput(taskDraftSchema, merged);
      const changedFields = EDITABLE_FIELDS.filter((field) => fields[field] !== task[field]);
      if (changedFields.length === 0) return task;

      // Optional fields absent from `fields` were cleared; reset them before merging.
      const updated: Task = compact({
        ...task,
        dueDate: undefined,
        estimatedMinutes: undefined,
        ...fields,
        updatedAt: ctx.now,
      });
      await db.tasks.put(updated);
      await db.taskEvents.add(buildEvent(ctx, id, 'edited', { changedFields: [...changedFields] }));
      return updated;
    });
  });
}

/**
 * Applies a status transition and records its event in one transaction, so a task can never
 * be marked done without the matching history entry (or vice versa).
 */
export async function transitionTask(
  id: string,
  action: TaskTransition,
  note?: string,
): Promise<Task> {
  return guard(async () => {
    const ctx = await writeContext();
    return db.transaction('rw', db.tasks, db.taskEvents, async () => {
      const task = await requireTask(id);
      if (!canTransition(task.status, action)) {
        throw new AppError(
          'invalid_operation',
          `Can't ${action} a task that is ${STATUS_LABELS[task.status].toLowerCase()}.`,
        );
      }
      const { to, event } = TRANSITIONS[action];
      const updated: Task = { ...task, status: to, updatedAt: ctx.now };
      if (to === 'done') updated.completedAt = ctx.now;
      else delete updated.completedAt;

      await db.tasks.put(updated);
      await db.taskEvents.add(
        buildEvent(ctx, id, event, { fromStatus: task.status, toStatus: to, note }),
      );
      return updated;
    });
  });
}

export const startTask = (id: string) => transitionTask(id, 'start');
export const completeTask = (id: string, note?: string) => transitionTask(id, 'complete', note);
export const cancelTask = (id: string, note?: string) => transitionTask(id, 'cancel', note);
export const reopenTask = (id: string, note?: string) => transitionTask(id, 'reopen', note);

/**
 * Archiving hides a task from lists but keeps it, its events, and its plan items. Tasks are
 * never hard-deleted locally because plans and reviews refer to them.
 */
export async function setTaskArchived(id: string, archived: boolean): Promise<Task> {
  return guard(async () => {
    const ctx = await writeContext();
    return db.transaction('rw', db.tasks, db.taskEvents, async () => {
      const task = await requireTask(id);
      if ((task.archivedAt !== undefined) === archived) return task;
      const updated: Task = { ...task, updatedAt: ctx.now };
      if (archived) updated.archivedAt = ctx.now;
      else delete updated.archivedAt;
      await db.tasks.put(updated);
      await db.taskEvents.add(buildEvent(ctx, id, archived ? 'archived' : 'restored'));
      return updated;
    });
  });
}

/*
 * Reads below feed live queries (see db/live.ts). Dexie tracks what a live query reads through
 * an async context that is lost when a query awaits nested native async helpers and then reads
 * again, so reads call Dexie directly and do not use `guard`. useLiveData normalizes errors.
 */

export function getTask(id: string): Promise<Task | undefined> {
  return db.tasks.get(id);
}

export type TaskFilter = 'inbox' | 'active' | 'done' | 'cancelled' | 'archived';

export interface TaskListItem {
  task: Task;
  /** Latest day this task is planned for (active, not rescheduled away). */
  plannedFor?: string | undefined;
}

const PRIORITY_RANK: Record<TaskPriority, number> = { high: 0, medium: 1, low: 2 };

function compareActive(a: Task, b: Task): number {
  return (
    PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] ||
    (a.dueDate ?? '9999').localeCompare(b.dueDate ?? '9999') ||
    a.createdAt.localeCompare(b.createdAt)
  );
}

export async function listTasks(filter: TaskFilter): Promise<TaskListItem[]> {
  let tasks: Task[];
  if (filter === 'archived') {
    tasks = (await db.tasks.toArray()).filter((t) => t.archivedAt !== undefined);
    tasks.sort((a, b) => (b.archivedAt ?? '').localeCompare(a.archivedAt ?? ''));
  } else {
    const statuses = filter === 'active' ? ['todo', 'in_progress'] : [filter];
    tasks = (await db.tasks.where('status').anyOf(statuses).toArray()).filter(
      (t) => t.archivedAt === undefined,
    );
    if (filter === 'active') tasks.sort(compareActive);
    else if (filter === 'done')
      tasks.sort((a, b) => (b.completedAt ?? '').localeCompare(a.completedAt ?? ''));
    else tasks.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  const items = await db.planItems
    .where('taskId')
    .anyOf(tasks.map((t) => t.id))
    .toArray();
  const plannedFor = latestPlannedDates(items);
  return tasks.map((task) => compact({ task, plannedFor: plannedFor.get(task.id) }));
}

/** Open, unarchived tasks — the candidates for planning. */
export async function listOpenTasks(): Promise<Task[]> {
  const tasks = await db.tasks
    .where('status')
    .anyOf([...OPEN_STATUSES])
    .toArray();
  return tasks.filter((t) => t.archivedAt === undefined).sort(compareActive);
}

export function latestPlannedDates(items: readonly PlanItem[]): Map<string, string> {
  const latest = new Map<string, string>();
  for (const item of items) {
    if (item.removedAt !== undefined || item.rescheduledTo !== undefined) continue;
    const current = latest.get(item.taskId);
    if (current === undefined || item.date > current) latest.set(item.taskId, item.date);
  }
  return latest;
}

const comparePlanItems = (a: PlanItem, b: PlanItem) =>
  a.date.localeCompare(b.date) || a.addedAt.localeCompare(b.addedAt);

export async function getTaskEvents(taskId: string): Promise<TaskEvent[]> {
  return (await db.taskEvents.where('taskId').equals(taskId).toArray()).sort(compareEvents);
}

export async function getTaskPlanHistory(taskId: string): Promise<PlanItem[]> {
  return (await db.planItems.where('taskId').equals(taskId).toArray()).sort(comparePlanItems);
}

export interface TaskDetail {
  task: Task;
  events: TaskEvent[];
  planItems: PlanItem[];
}

/** A task with its full event and plan history. */
export async function getTaskDetail(id: string): Promise<TaskDetail | undefined> {
  const task = await db.tasks.get(id);
  if (!task) return undefined;
  const events = await db.taskEvents.where('taskId').equals(id).toArray();
  const planItems = await db.planItems.where('taskId').equals(id).toArray();
  return {
    task,
    events: events.sort(compareEvents),
    planItems: planItems.sort(comparePlanItems),
  };
}
