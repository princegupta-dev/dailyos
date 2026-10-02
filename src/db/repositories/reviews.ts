import {
  reviewDraftSchema,
  reviewSchema,
  type Period,
  type PeriodType,
  type Review,
  type ReviewAction,
  type ReviewActionStatus,
  type ReviewDraft,
} from '@/domain/review';
import type { Task } from '@/domain/task';
import { newId } from '@/lib/ids';
import { db } from '../database';
import { AppError } from '../errors';
import { buildEvent, compact, guard, notFound, parseInput, writeContext } from './internal';

/**
 * Creates or updates the review for `period`. The unique [periodType+periodStart] index and
 * this read-then-write inside one transaction guarantee at most one review per period, even
 * if two tabs save at once (the second becomes an update, or fails with a conflict).
 *
 * Actions are synced with the draft: drafts with an id update that action, drafts without
 * one are created, and this review's actions missing from the draft are removed.
 */
export async function saveReview(period: Period, draft: ReviewDraft): Promise<Review> {
  const { actions, ...fields } = parseInput(reviewDraftSchema, draft);
  return guard(async () => {
    const ctx = await writeContext();
    if (period.start > ctx.today) {
      throw new AppError('invalid_operation', 'You can’t review a period that hasn’t started yet.');
    }
    return db.transaction('rw', db.reviews, db.reviewActions, async () => {
      const existing = await db.reviews
        .where('[periodType+periodStart]')
        .equals([period.type, period.start])
        .first();
      const review = parseInput(
        reviewSchema,
        compact({
          id: existing?.id ?? newId(),
          periodType: period.type,
          periodStart: period.start,
          periodEnd: period.end,
          ...fields,
          createdAt: existing?.createdAt ?? ctx.now,
          updatedAt: ctx.now,
        }),
      );
      await db.reviews.put(review);

      const current = await db.reviewActions.where('reviewId').equals(review.id).toArray();
      const currentById = new Map(current.map((a) => [a.id, a]));
      const keep = new Set<string>();
      for (const [position, action] of actions.entries()) {
        const previous = action.id ? currentById.get(action.id) : undefined;
        if (action.id && !previous) {
          throw new AppError('invalid_operation', 'An action belongs to a different review.');
        }
        const status = action.status;
        const next: ReviewAction = compact({
          id: previous?.id ?? newId(),
          reviewId: review.id,
          title: action.title,
          status,
          position,
          targetDate: action.targetDate,
          taskId: previous?.taskId,
          createdAt: previous?.createdAt ?? ctx.now,
          updatedAt: ctx.now,
          completedAt: status === 'done' ? (previous?.completedAt ?? ctx.now) : undefined,
        });
        keep.add(next.id);
        await db.reviewActions.put(next);
      }
      await db.reviewActions.bulkDelete(current.filter((a) => !keep.has(a.id)).map((a) => a.id));
      return review;
    });
  });
}

export async function setActionStatus(actionId: string, status: ReviewActionStatus): Promise<void> {
  return guard(async () => {
    const ctx = await writeContext();
    await db.transaction('rw', db.reviewActions, async () => {
      const action = await db.reviewActions.get(actionId);
      if (!action) throw notFound('Action');
      const updated: ReviewAction = { ...action, status, updatedAt: ctx.now };
      if (status === 'done') updated.completedAt = action.completedAt ?? ctx.now;
      else delete updated.completedAt;
      await db.reviewActions.put(updated);
    });
  });
}

/**
 * Turns an open action into an inbox task and links them. The action stays open until the
 * person marks it done, because finishing the task and closing the action are separate
 * decisions.
 */
export async function convertActionToTask(actionId: string): Promise<Task> {
  return guard(async () => {
    const ctx = await writeContext();
    return db.transaction('rw', db.reviewActions, db.tasks, db.taskEvents, async () => {
      const action = await db.reviewActions.get(actionId);
      if (!action) throw notFound('Action');
      if (action.taskId) {
        const linked = await db.tasks.get(action.taskId);
        if (linked) return linked;
      }
      const task: Task = compact({
        id: newId(),
        title: action.title,
        description: '',
        status: 'inbox',
        priority: 'medium',
        dueDate: action.targetDate,
        createdAt: ctx.now,
        updatedAt: ctx.now,
      });
      await db.tasks.add(task);
      await db.taskEvents.add(
        buildEvent(ctx, task.id, 'created', { toStatus: 'inbox', note: 'From a review action' }),
      );
      await db.reviewActions.put({ ...action, taskId: task.id, updatedAt: ctx.now });
      return task;
    });
  });
}

/* Reads call Dexie directly so live queries track them (see the note in tasks.ts). */

export interface ReviewWithActions {
  review?: Review | undefined;
  actions: ReviewAction[];
}

export async function getReviewForPeriod(
  type: PeriodType,
  start: string,
): Promise<ReviewWithActions> {
  const review = await db.reviews.where('[periodType+periodStart]').equals([type, start]).first();
  if (!review) return { actions: [] };
  const actions = await db.reviewActions.where('reviewId').equals(review.id).toArray();
  return { review, actions: actions.sort((a, b) => a.position - b.position) };
}

export interface OpenAction {
  action: ReviewAction;
  review: Review;
}

/** Open actions from reviews of periods that started before `beforeStart` (or all). */
export async function listOpenActions(beforeStart?: string): Promise<OpenAction[]> {
  const actions = await db.reviewActions.where('status').equals('open').toArray();
  const reviews = await db.reviews.bulkGet([...new Set(actions.map((a) => a.reviewId))]);
  const byId = new Map(reviews.flatMap((r) => (r ? [[r.id, r] as const] : [])));
  return actions
    .flatMap((action) => {
      const review = byId.get(action.reviewId);
      if (!review || (beforeStart !== undefined && review.periodStart >= beforeStart)) return [];
      return [{ action, review }];
    })
    .sort(
      (a, b) =>
        (a.action.targetDate ?? '9999').localeCompare(b.action.targetDate ?? '9999') ||
        a.action.createdAt.localeCompare(b.action.createdAt),
    );
}

export async function listReviews(limit: number): Promise<Review[]> {
  const reviews = await db.reviews.toArray();
  const typeOrder = { daily: 0, weekly: 1, monthly: 2 } as const;
  return reviews
    .sort(
      (a, b) =>
        b.periodStart.localeCompare(a.periodStart) ||
        typeOrder[a.periodType] - typeOrder[b.periodType],
    )
    .slice(0, limit);
}

/** Which of the given periods already have a review, keyed `type:start`. */
export async function reviewedPeriods(periods: readonly Period[]): Promise<Set<string>> {
  const found = await db.reviews
    .where('[periodType+periodStart]')
    .anyOf(periods.map((p) => [p.type, p.start]))
    .toArray();
  return new Set(found.map((r) => `${r.periodType}:${r.periodStart}`));
}
