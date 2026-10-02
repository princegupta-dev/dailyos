import { z } from 'zod';
import { dateKeySchema, idSchema, timestampSchema } from '@/lib/validation';
import { statusAtEndOf, TASK_PRIORITIES, type TaskEvent } from './task';

export const MAX_OUTCOMES = 3;

export const outcomeSchema = z.object({
  id: idSchema,
  text: z.string().trim().max(200),
  done: z.boolean(),
});
export type Outcome = z.infer<typeof outcomeSchema>;

export const dailyPlanSchema = z.object({
  id: idSchema,
  date: dateKeySchema,
  timezone: z.string().min(1),
  intention: z.string().trim().max(500),
  topOutcomes: z.array(outcomeSchema).max(MAX_OUTCOMES),
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
});
export type DailyPlan = z.infer<typeof dailyPlanSchema>;

/**
 * A task placed on a day's plan. Snapshot fields freeze what was planned, so later edits to
 * the task never rewrite history. Items are never deleted: unplanning sets `removedAt`, and
 * rescheduling sets `rescheduledTo` and adds a new item on the target day.
 */
export const planItemSchema = z.object({
  id: idSchema,
  planId: idSchema,
  taskId: idSchema,
  date: dateKeySchema,
  position: z.number().int().min(0),
  plannedMinutes: z.number().int().min(1).max(1440).optional(),
  titleSnapshot: z.string().min(1).max(200),
  prioritySnapshot: z.enum(TASK_PRIORITIES),
  addedAt: timestampSchema,
  removedAt: timestampSchema.optional(),
  rescheduledTo: dateKeySchema.optional(),
});
export type PlanItem = z.infer<typeof planItemSchema>;

export type PlanItemOutcome = 'done' | 'cancelled' | 'rescheduled' | 'open' | 'not_done';

/**
 * What happened to a planned item, derived from the task's event history rather than its
 * current status, so reopening a task next week doesn't change last week's results.
 */
export function derivePlanItemOutcome(
  item: Pick<PlanItem, 'date' | 'rescheduledTo'>,
  events: readonly TaskEvent[],
  today: string,
): PlanItemOutcome {
  const status = statusAtEndOf(item.date, events);
  if (status === 'done') return 'done';
  if (status === 'cancelled') return 'cancelled';
  if (item.rescheduledTo !== undefined) return 'rescheduled';
  return item.date < today ? 'not_done' : 'open';
}

export const OUTCOME_LABELS: Record<PlanItemOutcome, string> = {
  done: 'Done',
  cancelled: 'Cancelled',
  rescheduled: 'Rescheduled',
  open: 'Open',
  not_done: 'Not done',
};
