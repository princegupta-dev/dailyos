import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '@/db/database';
import {
  createLearningEntry,
  deleteLearningEntry,
  getLearningDetail,
  listDueReviews,
  listLearningForTask,
  listRecentLearning,
  searchLearning,
  setLearningArchived,
  setReviewDone,
  updateLearningEntry,
} from '@/db/repositories/learning';
import { createTask } from '@/db/repositories/tasks';
import { resetDatabase, setNow } from '../helpers/db';

beforeEach(async () => {
  await resetDatabase('Europe/London');
  setNow('2026-10-02T23:30:00Z'); // 00:30 on Oct 3 in London (BST)
});

afterEach(() => {
  vi.useRealTimers();
});

describe('capture', () => {
  it('saves a quick capture with only content, stamped with the local date', async () => {
    const entry = await createLearningEntry({ content: 'Zod 4 moved string formats to top level' });
    expect(entry).toMatchObject({
      title: 'Zod 4 moved string formats to top level',
      format: 'quick',
      capturedDate: '2026-10-03',
      relatedTaskIds: [],
      reviewDates: [],
    });
    expect(entry).not.toHaveProperty('topic');
  });

  it('rejects empty captures and unknown related tasks without writing', async () => {
    await expect(createLearningEntry({ content: ' ' })).rejects.toMatchObject({
      kind: 'validation',
    });
    await expect(
      createLearningEntry({
        content: 'x',
        relatedTaskIds: ['8a1f3c1e-5b8e-4d55-9a54-1c2b3d4e5f60'],
      }),
    ).rejects.toMatchObject({ kind: 'validation', issues: [{ path: 'relatedTaskIds' }] });
    expect(await db.learningEntries.count()).toBe(0);
  });
});

describe('editing', () => {
  it('turns a quick capture into a structured note without changing capture time', async () => {
    const task = await createTask({ title: 'Study Dexie' });
    const entry = await createLearningEntry({ content: 'liveQuery tracks reads' });
    setNow('2026-10-04T09:00:00Z');

    const updated = await updateLearningEntry(entry.id, {
      title: 'Dexie liveQuery',
      content: 'liveQuery tracks reads',
      topic: 'IndexedDB',
      explanation: 'Re-runs when the ranges it read change',
      relatedTaskIds: [task.id],
      reviewDates: ['2026-10-05'],
    });

    expect(updated).toMatchObject({
      format: 'structured',
      topic: 'IndexedDB',
      capturedAt: entry.capturedAt,
      capturedDate: '2026-10-03',
      updatedAt: '2026-10-04T09:00:00.000Z',
    });
    expect((await listLearningForTask(task.id)).map((e) => e.id)).toEqual([entry.id]);
    expect((await getLearningDetail(entry.id))?.relatedTasks.map((t) => t.title)).toEqual([
      'Study Dexie',
    ]);
  });

  it('keeps completion state for review dates that stay scheduled', async () => {
    const entry = await createLearningEntry({
      content: 'x',
      reviewDates: ['2026-10-03', '2026-10-10'],
    });
    await setReviewDone(entry.id, '2026-10-03', true);
    const updated = await updateLearningEntry(entry.id, {
      content: 'x',
      reviewDates: ['2026-10-03', '2026-11-02'],
    });
    expect(updated.reviewDates).toEqual([
      { date: '2026-10-03', completedAt: '2026-10-02T23:30:00.000Z' },
      { date: '2026-11-02' },
    ]);
  });
});

describe('reviews, archive, and delete', () => {
  it('lists due reviews until they are marked done', async () => {
    const entry = await createLearningEntry({
      content: 'Spaced repetition',
      reviewDates: ['2026-10-03', '2026-10-09'],
    });
    expect((await listDueReviews('2026-10-03')).map((d) => d.due)).toEqual(['2026-10-03']);
    await setReviewDone(entry.id, '2026-10-03', true);
    expect(await listDueReviews('2026-10-03')).toEqual([]);
    expect((await listDueReviews('2026-10-09')).map((d) => d.due)).toEqual(['2026-10-09']);
    await expect(setReviewDone(entry.id, '2026-12-01', true)).rejects.toMatchObject({
      kind: 'invalid_operation',
    });
  });

  it('archived entries leave search, recents, and due reviews but can be restored', async () => {
    const entry = await createLearningEntry({ content: 'Archive me', reviewDates: ['2026-10-03'] });
    await setLearningArchived(entry.id, true);
    expect((await searchLearning({})).entries).toEqual([]);
    expect((await searchLearning({}, true)).entries.map((e) => e.id)).toEqual([entry.id]);
    expect(await listRecentLearning(5)).toEqual([]);
    expect(await listDueReviews('2026-10-03')).toEqual([]);
    await setLearningArchived(entry.id, false);
    expect((await searchLearning({})).entries).toHaveLength(1);
  });

  it('deletes permanently', async () => {
    const entry = await createLearningEntry({ content: 'Temporary' });
    await deleteLearningEntry(entry.id);
    expect(await db.learningEntries.count()).toBe(0);
    await expect(deleteLearningEntry(entry.id)).rejects.toMatchObject({ kind: 'not_found' });
  });
});

describe('search through the repository', () => {
  it('filters by text, topic, and date, and reports available topics', async () => {
    await createLearningEntry({ content: 'Closures capture variables', topic: 'JavaScript' });
    setNow('2026-10-05T10:00:00Z');
    await createLearningEntry({ content: 'Generics constrain types', topic: 'TypeScript' });

    const ts = await searchLearning({ text: 'generics' });
    expect(ts.entries.map((e) => e.topic)).toEqual(['TypeScript']);
    expect(ts.topics).toEqual(['JavaScript', 'TypeScript']);
    expect(ts.total).toBe(2);
    expect((await searchLearning({ topic: 'javascript' })).entries).toHaveLength(1);
    expect((await searchLearning({ from: '2026-10-04' })).entries.map((e) => e.topic)).toEqual([
      'TypeScript',
    ]);
  });
});
