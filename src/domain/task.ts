import { z } from 'zod';
import { dateKeySchema, idSchema, optionalText, timestampSchema } from '@/lib/validation';

export const TASK_STATUSES = ['inbox', 'todo', 'in_progress', 'done', 'cancelled'] as const;
export const TASK_PRIORITIES = ['low', 'medium', 'high'] as const;

export type TaskStatus = (typeof TASK_STATUSES)[number];
export type TaskPriority = (typeof TASK_PRIORITIES)[number];

export const OPEN_STATUSES: readonly TaskStatus[] = ['inbox', 'todo', 'in_progress'];

export const taskSchema = z.object({
  id: idSchema,
  title: z.string().trim().min(1).max(200),
  description: z.string().max(5000),
  status: z.enum(TASK_STATUSES),
  priority: z.enum(TASK_PRIORITIES),
  dueDate: dateKeySchema.optional(),
  estimatedMinutes: z.number().int().min(1).max(1440).optional(),
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
  completedAt: timestampSchema.optional(),
  archivedAt: timestampSchema.optional(),
});
export type Task = z.infer<typeof taskSchema>;

/** Fields a person edits directly. Status changes go through explicit actions. */
export const taskDraftSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, 'Title is required')
    .max(200, 'Keep the title under 200 characters'),
  description: z.string().trim().max(5000).default(''),
  priority: z.enum(TASK_PRIORITIES).default('medium'),
  dueDate: dateKeySchema.optional(),
  estimatedMinutes: z
    .number()
    .int('Use whole minutes')
    .min(1, 'At least 1 minute')
    .max(1440, 'At most 24 hours')
    .optional(),
});
export type TaskDraft = z.input<typeof taskDraftSchema>;

export const TASK_EVENT_TYPES = [
  'created',
  'edited',
  'planned',
  'unplanned',
  'rescheduled',
  'started',
  'completed',
  'reopened',
  'cancelled',
  'archived',
  'restored',
] as const;
export type TaskEventType = (typeof TASK_EVENT_TYPES)[number];

/**
 * Append-only history. Status-changing events carry `toStatus`, which lets the status of a
 * task on any past day be reconstructed from events alone.
 */
export const taskEventSchema = z.object({
  id: idSchema,
  taskId: idSchema,
  type: z.enum(TASK_EVENT_TYPES),
  occurredAt: timestampSchema,
  localDate: dateKeySchema,
  note: optionalText(1000),
  fromStatus: z.enum(TASK_STATUSES).optional(),
  toStatus: z.enum(TASK_STATUSES).optional(),
  fromDate: dateKeySchema.optional(),
  toDate: dateKeySchema.optional(),
  changedFields: z.array(z.string()).optional(),
});
export type TaskEvent = z.infer<typeof taskEventSchema>;

export function isOpen(task: Pick<Task, 'status'>): boolean {
  return OPEN_STATUSES.includes(task.status);
}

/** Allowed status transitions, keyed by action. */
export const TRANSITIONS = {
  start: { from: ['inbox', 'todo'], to: 'in_progress', event: 'started' },
  complete: { from: ['inbox', 'todo', 'in_progress'], to: 'done', event: 'completed' },
  cancel: { from: ['inbox', 'todo', 'in_progress'], to: 'cancelled', event: 'cancelled' },
  reopen: { from: ['done', 'cancelled'], to: 'todo', event: 'reopened' },
} as const satisfies Record<
  string,
  { from: readonly TaskStatus[]; to: TaskStatus; event: TaskEventType }
>;
export type TaskTransition = keyof typeof TRANSITIONS;

export function canTransition(status: TaskStatus, action: TaskTransition): boolean {
  return (TRANSITIONS[action].from as readonly TaskStatus[]).includes(status);
}

/**
 * Chronological order. Events written by one operation share a timestamp; the only such
 * pair is `created` followed by `planned`, so `created` sorts first on a tie.
 */
export function compareEvents(a: TaskEvent, b: TaskEvent): number {
  return (
    a.occurredAt.localeCompare(b.occurredAt) ||
    Number(b.type === 'created') - Number(a.type === 'created')
  );
}

/** Status of a task at the end of `date`, reconstructed from its event history. */
export function statusAtEndOf(date: string, events: readonly TaskEvent[]): TaskStatus | undefined {
  let status: TaskStatus | undefined;
  for (const event of [...events].sort(compareEvents)) {
    if (event.localDate > date) break;
    if (event.toStatus) status = event.toStatus;
  }
  return status;
}

export const STATUS_LABELS: Record<TaskStatus, string> = {
  inbox: 'Inbox',
  todo: 'To do',
  in_progress: 'In progress',
  done: 'Done',
  cancelled: 'Cancelled',
};

export const PRIORITY_LABELS: Record<TaskPriority, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
};
