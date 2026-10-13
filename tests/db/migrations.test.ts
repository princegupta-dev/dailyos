import { afterEach, describe, expect, it } from 'vitest';
import { DailyOSDatabase, openWithVersionCheck } from '@/db/database';
import { CURRENT_SCHEMA_VERSION, SCHEMA_VERSIONS } from '@/db/schema';
import { accountSummaries } from '@/services/finance.service';

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

  it('v8 turns holdings into accounts with the same value, and regroups categories', async () => {
    const v7 = new DailyOSDatabase(
      NAME,
      SCHEMA_VERSIONS.filter((v) => v.version <= 7),
    );
    await v7.open();
    const valued = '44444444-4444-4444-8444-444444444444';
    const atCost = '55555555-5555-4555-8555-555555555555';
    const entry = (id: string, fields: Record<string, unknown>) => ({
      id,
      createdAt: T,
      updatedAt: T,
      ...fields,
    });
    // Records shaped exactly as v7 stored them.
    await v7.table('holdings').bulkAdd([
      {
        id: valued,
        name: 'Index fund',
        type: 'mutual_fund',
        currentValue: 12_000_00,
        valuedOn: '2026-09-15',
        createdAt: T,
        updatedAt: T,
      },
      { id: atCost, name: 'Gold', type: 'gold', createdAt: T, updatedAt: T },
    ]);
    await v7.table('financeEntries').bulkAdd([
      entry('66666666-6666-4666-8666-666666666661', {
        kind: 'investment',
        amount: 10_000_00,
        date: '2026-09-01',
        category: 'mutual_fund',
        holdingId: valued,
      }),
      // After the valuation: adds to it.
      entry('66666666-6666-4666-8666-666666666662', {
        kind: 'investment',
        amount: 1_000_00,
        date: '2026-09-20',
        category: 'mutual_fund',
        holdingId: valued,
      }),
      entry('66666666-6666-4666-8666-666666666663', {
        kind: 'investment',
        amount: 2_000_00,
        date: '2026-08-10',
        category: 'gold',
        holdingId: atCost,
      }),
      entry('66666666-6666-4666-8666-666666666664', {
        kind: 'expense',
        amount: 500_00,
        date: '2026-09-02',
        category: 'transport',
      }),
    ]);
    await v7.table('budgets').add({
      id: '77777777-7777-4777-8777-777777777777',
      period: 'monthly',
      category: 'food',
      limit: 5_000_00,
      createdAt: T,
      updatedAt: T,
    });
    v7.close();

    const current = new DailyOSDatabase(NAME);
    await current.open();
    const accounts = await current.accounts.toArray();
    const entries = await current.financeEntries.toArray();
    expect(current.tables.some((t) => t.name === 'holdings')).toBe(false);
    expect(accounts.map((a) => [a.id, a.type]).sort()).toEqual(
      [
        [valued, 'mutual_fund'],
        [atCost, 'gold_digital'],
      ].sort(),
    );
    expect(entries.find((e) => e.id.endsWith('1'))).toMatchObject({ toAccountId: valued });
    expect(entries.find((e) => e.id.endsWith('3'))).toMatchObject({
      toAccountId: atCost,
      category: 'gold_digital',
    });
    expect(entries.find((e) => e.id.endsWith('4'))?.category).toBe('transport_other');
    expect(entries.some((e) => 'holdingId' in e)).toBe(false);
    expect((await current.budgets.toArray())[0]?.category).toBe('dining_out');

    // Values match the old portfolio: market value plus later money, and cost when unvalued.
    const summaries = accountSummaries(accounts, entries, '2026-10-01');
    expect(summaries.find((s) => s.account.id === valued)).toMatchObject({
      value: 13_000_00,
      invested: 11_000_00,
      gain: 2_000_00,
    });
    expect(summaries.find((s) => s.account.id === atCost)).toMatchObject({
      value: 2_000_00,
      invested: 2_000_00,
    });
    current.close();
  });
});
