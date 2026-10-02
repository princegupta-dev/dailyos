import {
  distinctTopics,
  filterLearning,
  learningDraftSchema,
  nextDueReview,
  type LearningDraft,
  type LearningEntry,
  type LearningFilter,
} from '@/domain/learning';
import type { Task } from '@/domain/task';
import { newId } from '@/lib/ids';
import { db } from '../database';
import { AppError } from '../errors';
import { compact, guard, notFound, parseInput, writeContext } from './internal';

async function requireEntry(id: string): Promise<LearningEntry> {
  const entry = await db.learningEntries.get(id);
  if (!entry) throw notFound('Learning entry');
  return entry;
}

async function assertTasksExist(taskIds: readonly string[]): Promise<void> {
  const found = await db.tasks.bulkGet([...taskIds]);
  if (found.some((t) => t === undefined)) {
    throw new AppError('validation', 'A related task no longer exists.', {
      issues: [{ path: 'relatedTaskIds', message: 'A related task no longer exists' }],
    });
  }
}

/** Saves a new entry. Only content (or a title) is required; everything else is optional. */
export async function createLearningEntry(draft: LearningDraft): Promise<LearningEntry> {
  const { reviewDates, ...fields } = parseInput(learningDraftSchema, draft);
  return guard(async () => {
    const ctx = await writeContext();
    return db.transaction('rw', db.learningEntries, db.tasks, async () => {
      await assertTasksExist(fields.relatedTaskIds);
      const entry: LearningEntry = compact({
        id: newId(),
        ...fields,
        reviewDates: reviewDates.map((date) => ({ date })),
        capturedAt: ctx.now,
        capturedDate: ctx.today,
        updatedAt: ctx.now,
      });
      await db.learningEntries.add(entry);
      return entry;
    });
  });
}

/**
 * Replaces an entry's editable fields. Capture time never changes. Review dates that stay in
 * the schedule keep their completion state.
 */
export async function updateLearningEntry(
  id: string,
  draft: LearningDraft,
): Promise<LearningEntry> {
  const { reviewDates, ...fields } = parseInput(learningDraftSchema, draft);
  return guard(async () => {
    const ctx = await writeContext();
    return db.transaction('rw', db.learningEntries, db.tasks, async () => {
      const entry = await requireEntry(id);
      await assertTasksExist(fields.relatedTaskIds);
      const previous = new Map(entry.reviewDates.map((r) => [r.date, r]));
      const updated: LearningEntry = compact({
        id: entry.id,
        capturedAt: entry.capturedAt,
        capturedDate: entry.capturedDate,
        archivedAt: entry.archivedAt,
        ...fields,
        reviewDates: reviewDates.map((date) => previous.get(date) ?? { date }),
        updatedAt: ctx.now,
      });
      await db.learningEntries.put(updated);
      return updated;
    });
  });
}

export async function setReviewDone(id: string, date: string, done: boolean): Promise<void> {
  return guard(async () => {
    const ctx = await writeContext();
    await db.transaction('rw', db.learningEntries, async () => {
      const entry = await requireEntry(id);
      if (!entry.reviewDates.some((r) => r.date === date)) {
        throw new AppError('invalid_operation', 'That review date isn’t scheduled.');
      }
      const reviewDates = entry.reviewDates.map((r) =>
        r.date !== date ? r : done ? { date, completedAt: ctx.now } : { date },
      );
      await db.learningEntries.put({ ...entry, reviewDates, updatedAt: ctx.now });
    });
  });
}

export async function setLearningArchived(id: string, archived: boolean): Promise<void> {
  return guard(async () => {
    const ctx = await writeContext();
    await db.transaction('rw', db.learningEntries, async () => {
      const entry = await requireEntry(id);
      const updated: LearningEntry = { ...entry, updatedAt: ctx.now };
      if (archived) updated.archivedAt = ctx.now;
      else delete updated.archivedAt;
      await db.learningEntries.put(updated);
    });
  });
}

/**
 * Permanently deletes an entry. Nothing else references learning entries, so this can't
 * break other records. The UI asks for confirmation first.
 */
export async function deleteLearningEntry(id: string): Promise<void> {
  return guard(async () => {
    await requireEntry(id);
    await db.learningEntries.delete(id);
  });
}

/* Reads call Dexie directly so live queries track them (see the note in tasks.ts). */

export interface LearningSearchResult {
  entries: LearningEntry[];
  topics: string[];
  total: number;
}

export async function searchLearning(
  filter: LearningFilter,
  includeArchived = false,
): Promise<LearningSearchResult> {
  const all = (await db.learningEntries.toArray()).filter(
    (e) => includeArchived === (e.archivedAt !== undefined),
  );
  return { entries: filterLearning(all, filter), topics: distinctTopics(all), total: all.length };
}

export async function listRecentLearning(limit: number): Promise<LearningEntry[]> {
  const recent = await db.learningEntries.orderBy('capturedAt').reverse().toArray();
  return recent.filter((e) => e.archivedAt === undefined).slice(0, limit);
}

export async function listDueReviews(
  today: string,
): Promise<{ entry: LearningEntry; due: string }[]> {
  const entries = await db.learningEntries.toArray();
  return entries
    .flatMap((entry) => {
      const due = entry.archivedAt === undefined ? nextDueReview(entry, today) : undefined;
      return due ? [{ entry, due }] : [];
    })
    .sort((a, b) => a.due.localeCompare(b.due));
}

export interface LearningDetail {
  entry: LearningEntry;
  relatedTasks: Task[];
}

export async function getLearningDetail(id: string): Promise<LearningDetail | undefined> {
  const entry = await db.learningEntries.get(id);
  if (!entry) return undefined;
  const tasks = await db.tasks.bulkGet(entry.relatedTaskIds);
  return { entry, relatedTasks: tasks.filter((t): t is Task => t !== undefined) };
}

export async function listLearningForTask(taskId: string): Promise<LearningEntry[]> {
  const entries = await db.learningEntries.where('relatedTaskIds').equals(taskId).toArray();
  return entries.sort((a, b) => b.capturedAt.localeCompare(a.capturedAt));
}
