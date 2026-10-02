import { afterEach, describe, expect, it } from 'vitest';
import { DailyOSDatabase, openWithVersionCheck } from '@/db/database';
import { CURRENT_SCHEMA_VERSION, SCHEMA_VERSIONS } from '@/db/schema';

const NAME = 'dailyos-migration-test';
const T = '2026-10-01T00:00:00.000Z';

afterEach(async () => {
  await new DailyOSDatabase(NAME).delete();
});

describe('schema migrations', () => {
  it('declares strictly increasing versions', () => {
    const versions = SCHEMA_VERSIONS.map((v) => v.version);
    expect(versions).toEqual([...versions].sort((a, b) => a - b));
    expect(new Set(versions).size).toBe(versions.length);
    expect(CURRENT_SCHEMA_VERSION).toBe(versions.at(-1));
  });

  it.each(SCHEMA_VERSIONS.slice(0, -1).map((v) => v.version))(
    'upgrades from version %i to the current version without losing data',
    async (fromVersion) => {
      const old = new DailyOSDatabase(
        NAME,
        SCHEMA_VERSIONS.filter((v) => v.version <= fromVersion),
      );
      await old.open();
      await old.tasks.add({
        id: '11111111-1111-4111-8111-111111111111',
        title: 'Written before the upgrade',
        description: '',
        status: 'todo',
        priority: 'medium',
        createdAt: T,
        updatedAt: T,
      });
      await old.settings.put({
        id: 'app',
        weekStartsOn: 0,
        timeZone: 'Europe/Berlin',
        updatedAt: T,
      });
      old.close();

      const current = new DailyOSDatabase(NAME);
      await current.open();
      expect(current.verno).toBe(CURRENT_SCHEMA_VERSION);
      expect((await current.tasks.toArray()).map((t) => t.title)).toEqual([
        'Written before the upgrade',
      ]);
      expect(await current.settings.get('app')).toMatchObject({
        weekStartsOn: 0,
        timeZone: 'Europe/Berlin',
      });
      // Stores added later exist and are usable.
      expect(await current.habits.count()).toBe(0);
      current.close();
    },
  );

  it('v5 gives existing habits, entries, and notes safe defaults without changing their data', async () => {
    const v4 = new DailyOSDatabase(
      NAME,
      SCHEMA_VERSIONS.filter((v) => v.version <= 4),
    );
    await v4.open();
    const habitId = '22222222-2222-4222-8222-222222222222';
    // Records shaped exactly as v4 stored them (no category, no tags).
    await v4.table('habits').add({
      id: habitId,
      name: 'Gym',
      frequency: 'selected_days',
      weekdays: [1, 3, 5],
      startDate: '2026-09-01',
      position: 0,
      createdAt: T,
      updatedAt: T,
    });
    await v4.table('habitEntries').add({
      id: '33333333-3333-4333-8333-333333333333',
      habitId,
      date: '2026-09-02',
      status: 'completed',
      note: 'Legs',
      createdAt: T,
      updatedAt: T,
    });
    await v4.table('learningEntries').add({
      id: '44444444-4444-4444-8444-444444444444',
      title: 'Old note',
      format: 'quick',
      content: 'Old note',
      topic: 'Databases',
      relatedTaskIds: [],
      capturedAt: T,
      capturedDate: '2026-09-02',
      updatedAt: T,
      reviewDates: [],
    });
    v4.close();

    const current = new DailyOSDatabase(NAME);
    await current.open();
    expect(await current.habits.get(habitId)).toMatchObject({
      name: 'Gym',
      category: 'other',
      weekdays: [1, 3, 5],
    });
    expect(await current.habitEntries.toArray()).toMatchObject([
      { note: 'Legs', status: 'completed', tags: [] },
    ]);
    expect(await current.learningEntries.toArray()).toMatchObject([
      { topic: 'Databases', tags: [] },
    ]);
    // New multi-entry tag indexes are usable immediately.
    expect(await current.habitEntries.where('tags').equals('x').count()).toBe(0);
    current.close();
  });

  it('refuses to open a database created by a newer app version instead of resetting it', async () => {
    const future = new DailyOSDatabase(NAME, [
      ...SCHEMA_VERSIONS,
      { version: CURRENT_SCHEMA_VERSION + 1, stores: { futureStore: 'id' } },
    ]);
    await future.open();
    future.close();

    const current = new DailyOSDatabase(NAME);
    await expect(openWithVersionCheck(current)).rejects.toMatchObject({ kind: 'version' });
    expect(current.isOpen()).toBe(false);

    // The newer data is untouched.
    const check = new DailyOSDatabase(NAME, [
      ...SCHEMA_VERSIONS,
      { version: CURRENT_SCHEMA_VERSION + 1, stores: { futureStore: 'id' } },
    ]);
    await check.open();
    expect(check.tables.map((t) => t.name)).toContain('futureStore');
    check.close();
  });
});
