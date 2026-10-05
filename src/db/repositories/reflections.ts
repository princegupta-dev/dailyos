import {
  isEmptyReflection,
  itemReflectionDraftSchema,
  itemReflectionSchema,
  reflectionKey,
  type ItemReflection,
  type ItemReflectionDraft,
  type ReflectionSubject,
} from '@/domain/reflection';
import { isDateKey } from '@/lib/dates';
import { newId } from '@/lib/ids';
import { db } from '../database';
import { AppError } from '../errors';
import { compact, guard, notFound, parseInput, writeContext } from './internal';

/**
 * Saves the reflection on one habit or task for `date`. Each subject has at most one per
 * date: the unique [subjectType+subjectId+date] index and this read-then-write inside one
 * transaction make a second save an update. Saving an empty draft clears the reflection.
 *
 * Returns the saved reflection, or undefined when it was cleared.
 */
export async function saveItemReflection(
  subject: ReflectionSubject,
  date: string,
  draft: ItemReflectionDraft,
): Promise<ItemReflection | undefined> {
  const fields = parseInput(itemReflectionDraftSchema, draft);
  if (!isDateKey(date)) throw new AppError('validation', 'Expected a YYYY-MM-DD date.');
  return guard(async () => {
    const ctx = await writeContext();
    if (date > ctx.today) {
      throw new AppError('invalid_operation', 'You can’t reflect on a day that hasn’t happened.');
    }
    return db.transaction('rw', db.itemReflections, db.habits, db.tasks, async () => {
      const exists =
        subject.type === 'habit'
          ? (await db.habits.get(subject.id)) !== undefined
          : (await db.tasks.get(subject.id)) !== undefined;
      if (!exists) throw notFound(subject.type === 'habit' ? 'Habit' : 'Task');

      const existing = await db.itemReflections
        .where('[subjectType+subjectId+date]')
        .equals([subject.type, subject.id, date])
        .first();
      if (isEmptyReflection(fields)) {
        if (existing) await db.itemReflections.delete(existing.id);
        return undefined;
      }
      const reflection = parseInput(
        itemReflectionSchema,
        compact({
          id: existing?.id ?? newId(),
          subjectType: subject.type,
          subjectId: subject.id,
          date,
          ...fields,
          createdAt: existing?.createdAt ?? ctx.now,
          updatedAt: ctx.now,
        }),
      );
      await db.itemReflections.put(reflection);
      return reflection;
    });
  });
}

/* Reads call Dexie directly so live queries track them (see the note in tasks.ts). */

export interface DayReflection {
  reflection: ItemReflection;
  /** Current name of the habit or task, or undefined if it has since been deleted. */
  name: string | undefined;
}

/** Reflections on one habit or task, newest first, up to `limit`. */
export async function listReflectionsForSubject(
  subject: ReflectionSubject,
  limit: number,
): Promise<ItemReflection[]> {
  const rows = await db.itemReflections
    .filter((r) => r.subjectType === subject.type && r.subjectId === subject.id)
    .toArray();
  return rows.sort((a, b) => b.date.localeCompare(a.date)).slice(0, limit);
}

/** Every habit and task reflection written for `date`, with the name of what it's about. */
export async function listReflectionsForDate(date: string): Promise<DayReflection[]> {
  const reflections = await db.itemReflections.where('date').equals(date).toArray();
  const ids = (type: ReflectionSubject['type']) =>
    reflections.filter((r) => r.subjectType === type).map((r) => r.subjectId);
  const [habits, tasks] = await Promise.all([
    db.habits.bulkGet(ids('habit')),
    db.tasks.bulkGet(ids('task')),
  ]);
  const names = new Map<string, string>([
    ...habits.flatMap((h) =>
      h ? [[reflectionKey({ type: 'habit', id: h.id }), h.name] as const] : [],
    ),
    ...tasks.flatMap((t) =>
      t ? [[reflectionKey({ type: 'task', id: t.id }), t.title] as const] : [],
    ),
  ]);
  return reflections.map((reflection) => ({
    reflection,
    name: names.get(reflectionKey({ type: reflection.subjectType, id: reflection.subjectId })),
  }));
}
