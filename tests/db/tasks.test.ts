import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { db, DailyOSDatabase } from '@/db/database';
import { AppError } from '@/db/errors';
import {
  cancelTask,
  completeTask,
  createTask,
  getTask,
  getTaskEvents,
  listTasks,
  reopenTask,
  setTaskArchived,
  startTask,
  updateTask,
} from '@/db/repositories/tasks';
import { resetDatabase, setNow } from '../helpers/db';

beforeEach(async () => {
  await resetDatabase();
  setNow('2026-10-02T09:00:00Z');
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('task creation', () => {
  it('creates an inbox task with defaults and a created event', async () => {
    const task = await createTask({ title: '  Write tests  ' });

    expect(task).toMatchObject({
      title: 'Write tests',
      description: '',
      priority: 'medium',
      status: 'inbox',
      createdAt: '2026-10-02T09:00:00.000Z',
    });
    expect(task).not.toHaveProperty('dueDate');
    const events = await getTaskEvents(task.id);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      type: 'created',
      toStatus: 'inbox',
      localDate: '2026-10-02',
    });
  });

  it('rejects invalid input with field-level issues and writes nothing', async () => {
    const error = await createTask({ title: '   ', estimatedMinutes: 0 }).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(AppError);
    expect((error as AppError).kind).toBe('validation');
    expect((error as AppError).issues.map((i) => i.path).sort()).toEqual([
      'estimatedMinutes',
      'title',
    ]);
    expect(await db.tasks.count()).toBe(0);
  });

  it('records the local date of events in the configured time zone', async () => {
    await resetDatabase('Asia/Kolkata');
    setNow('2026-10-02T20:00:00Z'); // 01:30 on Oct 3 in India
    const task = await createTask({ title: 'Late night idea' });
    const [event] = await getTaskEvents(task.id);
    expect(event?.localDate).toBe('2026-10-03');
  });
});

describe('task editing', () => {
  it('updates fields, clears optional ones, and records which fields changed', async () => {
    const task = await createTask({ title: 'Draft', dueDate: '2026-10-05', estimatedMinutes: 30 });
    setNow('2026-10-02T10:00:00Z');

    const updated = await updateTask(task.id, { title: 'Final', dueDate: undefined });

    expect(updated.title).toBe('Final');
    expect(updated).not.toHaveProperty('dueDate');
    expect(updated.estimatedMinutes).toBe(30);
    expect(updated.updatedAt).toBe('2026-10-02T10:00:00.000Z');
    const events = await getTaskEvents(task.id);
    expect(events.at(-1)).toMatchObject({ type: 'edited', changedFields: ['title', 'dueDate'] });
  });

  it('does not record an event when nothing changed', async () => {
    const task = await createTask({ title: 'Same' });
    await updateTask(task.id, { title: 'Same' });
    expect(await getTaskEvents(task.id)).toHaveLength(1);
  });

  it('reports a missing task as not_found', async () => {
    await expect(
      updateTask('8a1f3c1e-5b8e-4d55-9a54-1c2b3d4e5f60', { title: 'x' }),
    ).rejects.toMatchObject({
      kind: 'not_found',
    });
  });
});

describe('status transitions', () => {
  it('completes, reopens, and keeps the full history', async () => {
    const task = await createTask({ title: 'Ship it' });
    setNow('2026-10-02T09:30:00Z');
    await startTask(task.id);
    setNow('2026-10-02T15:00:00Z');
    const done = await completeTask(task.id, 'Went smoothly');
    expect(done.status).toBe('done');
    expect(done.completedAt).toBe('2026-10-02T15:00:00.000Z');

    setNow('2026-10-03T08:00:00Z');
    const reopened = await reopenTask(task.id);
    expect(reopened.status).toBe('todo');
    expect(reopened).not.toHaveProperty('completedAt');

    const events = await getTaskEvents(task.id);
    expect(events.map((e) => [e.type, e.fromStatus, e.toStatus])).toEqual([
      ['created', undefined, 'inbox'],
      ['started', 'inbox', 'in_progress'],
      ['completed', 'in_progress', 'done'],
      ['reopened', 'done', 'todo'],
    ]);
    expect(events[2]?.note).toBe('Went smoothly');
    expect(events[3]?.localDate).toBe('2026-10-03');
  });

  it('cancels and rejects invalid transitions', async () => {
    const task = await createTask({ title: 'Maybe' });
    await cancelTask(task.id);
    await expect(completeTask(task.id)).rejects.toMatchObject({ kind: 'invalid_operation' });
    await expect(startTask(task.id)).rejects.toMatchObject({ kind: 'invalid_operation' });
    expect((await getTask(task.id))?.status).toBe('cancelled');
  });

  it('completes atomically: if the event cannot be written the task is unchanged', async () => {
    const task = await createTask({ title: 'Atomic' });
    vi.spyOn(db.taskEvents, 'add').mockRejectedValueOnce(new Error('disk failure'));

    await expect(completeTask(task.id)).rejects.toBeInstanceOf(AppError);

    expect((await getTask(task.id))?.status).toBe('inbox');
    expect((await getTaskEvents(task.id)).map((e) => e.type)).toEqual(['created']);
  });

  it('maps quota failures to a quota error without partial writes', async () => {
    const task = await createTask({ title: 'Full disk' });
    vi.spyOn(db.tasks, 'put').mockRejectedValueOnce(
      new DOMException('Quota exceeded', 'QuotaExceededError'),
    );

    await expect(completeTask(task.id)).rejects.toMatchObject({ kind: 'quota' });
    expect((await getTask(task.id))?.status).toBe('inbox');
  });
});

describe('archiving and listing', () => {
  it('lists tasks by filter and hides archived tasks', async () => {
    const inbox = await createTask({ title: 'Inbox item' });
    const low = await createTask({ title: 'Low', priority: 'low' }, { planFor: '2026-10-02' });
    const high = await createTask({ title: 'High', priority: 'high' }, { planFor: '2026-10-03' });
    const done = await createTask({ title: 'Done' });
    await completeTask(done.id);

    expect((await listTasks('inbox')).map((i) => i.task.id)).toEqual([inbox.id]);
    const active = await listTasks('active');
    expect(active.map((i) => i.task.id)).toEqual([high.id, low.id]);
    expect(active[0]?.plannedFor).toBe('2026-10-03');
    expect((await listTasks('done')).map((i) => i.task.id)).toEqual([done.id]);

    setNow('2026-10-02T10:00:00Z');
    await setTaskArchived(inbox.id, true);
    expect(await listTasks('inbox')).toEqual([]);
    expect((await listTasks('archived')).map((i) => i.task.id)).toEqual([inbox.id]);

    setNow('2026-10-02T11:00:00Z');
    await setTaskArchived(inbox.id, false);
    expect((await listTasks('inbox')).map((i) => i.task.id)).toEqual([inbox.id]);
    expect((await getTaskEvents(inbox.id)).map((e) => e.type)).toEqual([
      'created',
      'archived',
      'restored',
    ]);
  });
});

describe('persistence', () => {
  it('keeps records after the database is closed and reopened (simulated reload)', async () => {
    const task = await createTask({ title: 'Survives reload' });
    await completeTask(task.id);
    db.close();

    const reopened = new DailyOSDatabase();
    await reopened.open();
    expect((await reopened.tasks.get(task.id))?.status).toBe('done');
    expect(await reopened.taskEvents.where('taskId').equals(task.id).count()).toBe(2);
    reopened.close();
    await db.open();
  });
});
