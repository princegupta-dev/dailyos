import { describe, expect, it } from 'vitest';
import {
  currentStreak,
  describeSchedule,
  habitDraftSchema,
  habitStats,
  longestStreak,
  habitOccurrences,
  occurrenceFor,
  occurrencesToDate,
  summarizeOccurrences,
  type Habit,
  type HabitEntry,
  type HabitStatus,
} from '@/domain/habit';
import { addMonths, eachDay, endOfMonth, startOfWeek } from '@/lib/dates';

const T = '2026-10-01T00:00:00.000Z';
const HABIT_ID = '0b4a2f5e-6f61-4e0a-9d1e-7a2b3c4d5e6f';

function habit(overrides: Partial<Habit> = {}): Habit {
  return {
    id: HABIT_ID,
    name: 'Read',
    category: 'reading',
    frequency: 'daily',
    startDate: '2026-09-28',
    position: 0,
    createdAt: T,
    updatedAt: T,
    ...overrides,
  };
}

let n = 0;
function entry(date: string, status: HabitStatus): HabitEntry {
  n++;
  return {
    id: `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`,
    habitId: HABIT_ID,
    date,
    status,
    tags: [],
    createdAt: T,
    updatedAt: T,
  };
}

describe('date helpers used by habits', () => {
  it('finds the start of the week for Monday- and Sunday-based weeks', () => {
    // 2026-10-02 is a Friday.
    expect(startOfWeek('2026-10-02', 1)).toBe('2026-09-28');
    expect(startOfWeek('2026-10-02', 0)).toBe('2026-09-27');
    expect(startOfWeek('2026-09-28', 1)).toBe('2026-09-28');
    expect(startOfWeek('2026-09-27', 1)).toBe('2026-09-21');
  });

  it('handles month ends and leap years', () => {
    expect(endOfMonth('2026-02-10')).toBe('2026-02-28');
    expect(endOfMonth('2028-02-10')).toBe('2028-02-29');
    expect(addMonths('2026-12-15', 1)).toBe('2027-01-01');
    expect(addMonths('2026-01-31', -1)).toBe('2025-12-01');
  });

  it('enumerates calendar days across a DST change without gaps or duplicates', () => {
    // US DST ends 2026-11-01 (a 25-hour day locally); date keys are unaffected.
    expect(eachDay('2026-10-31', '2026-11-02')).toEqual(['2026-10-31', '2026-11-01', '2026-11-02']);
  });
});

describe('habit draft validation', () => {
  it('requires weekdays for selected-day habits and drops them otherwise', () => {
    expect(
      habitDraftSchema.safeParse({ name: 'Gym', frequency: 'selected_days', weekdays: [] }).success,
    ).toBe(false);
    expect(
      habitDraftSchema.parse({ name: 'Gym', frequency: 'selected_days', weekdays: [5, 1, 3] })
        .weekdays,
    ).toEqual([1, 3, 5]);
    expect(
      habitDraftSchema.parse({ name: 'Read', frequency: 'daily', weekdays: [1] }).weekdays,
    ).toBeUndefined();
  });
});

describe('daily habits', () => {
  it('counts past days without entries as missed and today as pending', () => {
    const h = habit();
    const occ = habitOccurrences(
      h,
      [entry('2026-09-28', 'completed')],
      '2026-09-28',
      '2026-10-04',
      '2026-09-30',
      1,
    );
    expect(occ.map((o) => [o.start, o.status])).toEqual([
      ['2026-09-28', 'completed'],
      ['2026-09-29', 'missed'],
      ['2026-09-30', 'pending'],
    ]);
  });

  it('ignores days before the start date and from the archive date on', () => {
    const h = habit({ startDate: '2026-09-29', archivedOn: '2026-10-01' });
    const occ = habitOccurrences(h, [], '2026-09-28', '2026-10-03', '2026-10-05', 1);
    expect(occ.map((o) => o.start)).toEqual(['2026-09-29', '2026-09-30']);
  });

  it('does not treat skipped days as failures', () => {
    const h = habit();
    const occ = habitOccurrences(
      h,
      [
        entry('2026-09-28', 'completed'),
        entry('2026-09-29', 'skipped'),
        entry('2026-09-30', 'completed'),
      ],
      '2026-09-28',
      '2026-09-30',
      '2026-10-01',
      1,
    );
    expect(summarizeOccurrences(occ)).toEqual({
      completed: 2,
      skipped: 1,
      missed: 0,
      pending: 0,
      rate: 1,
    });
    expect(currentStreak(occ)).toBe(2);
  });

  it('breaks the streak on a missed day but not on today’s pending occurrence', () => {
    const h = habit();
    const entries = [
      entry('2026-09-28', 'completed'),
      entry('2026-09-30', 'completed'),
      entry('2026-10-01', 'completed'),
    ];
    const occ = occurrencesToDate(h, entries, '2026-10-02', 1);
    expect(occ.at(-1)?.status).toBe('pending');
    expect(currentStreak(occ)).toBe(2);
  });

  it('returns a null rate when nothing is eligible yet', () => {
    expect(summarizeOccurrences([]).rate).toBeNull();
  });
});

describe('selected-day habits', () => {
  it('only creates occurrences on chosen weekdays', () => {
    const h = habit({ frequency: 'selected_days', weekdays: [1, 3, 5] }); // Mon, Wed, Fri
    const occ = habitOccurrences(
      h,
      [entry('2026-09-30', 'completed')],
      '2026-09-28',
      '2026-10-04',
      '2026-10-05',
      1,
    );
    expect(occ.map((o) => [o.start, o.status])).toEqual([
      ['2026-09-28', 'missed'],
      ['2026-09-30', 'completed'],
      ['2026-10-02', 'missed'],
    ]);
  });

  it('has no occurrence on unscheduled days', () => {
    const h = habit({ frequency: 'selected_days', weekdays: [1] });
    expect(occurrenceFor(h, [], '2026-09-29', '2026-09-29', 1)).toBeUndefined();
  });
});

describe('weekly habits', () => {
  it('is satisfied by one completion on any day of the week', () => {
    const h = habit({ frequency: 'weekly', startDate: '2026-09-14' });
    const occ = habitOccurrences(
      h,
      [entry('2026-09-17', 'completed'), entry('2026-09-26', 'skipped')],
      '2026-09-14',
      '2026-10-04',
      '2026-10-01',
      1,
    );
    expect(occ.map((o) => [o.start, o.end, o.status])).toEqual([
      ['2026-09-14', '2026-09-20', 'completed'],
      ['2026-09-21', '2026-09-27', 'skipped'],
      ['2026-09-28', '2026-10-04', 'pending'],
    ]);
  });

  it('shows the current week’s status on any day of that week', () => {
    const h = habit({ frequency: 'weekly' });
    const entries = [entry('2026-09-29', 'completed')];
    expect(occurrenceFor(h, entries, '2026-10-02', '2026-10-02', 1)?.status).toBe('completed');
    expect(occurrenceFor(h, [], '2026-10-02', '2026-10-02', 1)?.status).toBe('pending');
  });

  it('assigns each week to exactly one range so consecutive ranges never double count', () => {
    const h = habit({ frequency: 'weekly', startDate: '2026-08-31' });
    const sept = habitOccurrences(h, [], '2026-09-01', endOfMonth('2026-09-01'), '2026-12-01', 1);
    const oct = habitOccurrences(h, [], '2026-10-01', endOfMonth('2026-10-01'), '2026-12-01', 1);
    const starts = [...sept, ...oct].map((o) => o.start);
    expect(new Set(starts).size).toBe(starts.length);
    expect(sept.map((o) => o.start)).toEqual([
      '2026-09-07',
      '2026-09-14',
      '2026-09-21',
      '2026-09-28',
    ]);
  });

  it('respects a Sunday week start', () => {
    const h = habit({ frequency: 'weekly', startDate: '2026-09-27' });
    const occ = habitOccurrences(
      h,
      [entry('2026-10-03', 'completed')],
      '2026-09-27',
      '2026-10-03',
      '2026-10-03',
      0,
    );
    expect(occ).toEqual([{ start: '2026-09-27', end: '2026-10-03', status: 'completed' }]);
  });
});

describe('streak rules', () => {
  // Rules (documented in ARCHITECTURE.md):
  // - Only scheduled occurrences exist; unscheduled days can't break a streak.
  // - completed extends a run; skipped is neutral; missed ends a run.
  // - Today's pending occurrence neither extends nor ends the current streak.
  const statuses = (...s: ('completed' | 'skipped' | 'missed' | 'pending')[]) =>
    s.map((status, i) => ({ start: `d${i}`, end: `d${i}`, status }));

  it('computes current and longest streaks with skipped as neutral', () => {
    const occ = statuses(
      'completed',
      'completed',
      'completed',
      'missed',
      'completed',
      'skipped',
      'completed',
      'pending',
    );
    expect(currentStreak(occ)).toBe(2);
    expect(longestStreak(occ)).toBe(3);
    expect(habitStats(occ)).toEqual({ currentStreak: 2, longestStreak: 3, totalCompletions: 5 });
  });

  it('resets the current streak after a miss but keeps the longest in history', () => {
    const occ = statuses('completed', 'completed', 'missed');
    expect(currentStreak(occ)).toBe(0);
    expect(longestStreak(occ)).toBe(2);
  });

  it('does not let unscheduled days break a selected-days streak', () => {
    const h = habit({ frequency: 'selected_days', weekdays: [1, 3, 5] }); // Mon, Wed, Fri
    const entries = ['2026-09-28', '2026-09-30', '2026-10-02'].map((d) => entry(d, 'completed'));
    const occ = occurrencesToDate(h, entries, '2026-10-04', 1); // through Sunday
    expect(occ.map((o) => o.start)).toEqual(['2026-09-28', '2026-09-30', '2026-10-02']);
    expect(habitStats(occ)).toEqual({ currentStreak: 3, longestStreak: 3, totalCompletions: 3 });
  });

  it('never invents completions: unlogged past days stay missed', () => {
    const h = habit();
    const occ = occurrencesToDate(h, [entry('2026-09-28', 'completed')], '2026-09-30', 1);
    expect(occ.map((o) => o.status)).toEqual(['completed', 'missed', 'pending']);
    expect(currentStreak(occ)).toBe(0);
  });

  it('resumes through new completions without rewriting the earlier miss', () => {
    const h = habit();
    const entries = [
      entry('2026-09-28', 'completed'),
      entry('2026-09-30', 'completed'),
      entry('2026-10-01', 'completed'),
    ];
    const occ = occurrencesToDate(h, entries, '2026-10-01', 1);
    expect(occ.map((o) => o.status)).toEqual(['completed', 'missed', 'completed', 'completed']);
    expect(habitStats(occ)).toMatchObject({ currentStreak: 2, longestStreak: 2 });
  });

  it('counts weekly streaks in weeks', () => {
    const h = habit({ frequency: 'weekly', startDate: '2026-09-14' });
    const entries = [
      entry('2026-09-15', 'completed'),
      entry('2026-09-26', 'completed'),
      entry('2026-10-01', 'completed'),
    ];
    const occ = occurrencesToDate(h, entries, '2026-10-02', 1);
    expect(habitStats(occ)).toEqual({ currentStreak: 3, longestStreak: 3, totalCompletions: 3 });
  });

  it('describes Monday–Friday as weekdays', () => {
    expect(describeSchedule({ frequency: 'selected_days', weekdays: [1, 2, 3, 4, 5] })).toBe(
      'Weekdays',
    );
    expect(describeSchedule({ frequency: 'selected_days', weekdays: [1, 3] })).toBe('Mon, Wed');
  });
});
