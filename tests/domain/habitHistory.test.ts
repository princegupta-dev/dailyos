import { describe, expect, it } from 'vitest';
import type { Habit, HabitEntry, Occurrence } from '@/domain/habit';
import {
  dayState,
  heatmapDays,
  nextMilestone,
  strongestWeekday,
  weeklyTrend,
} from '@/features/habits/habitHistory';

const habit = (patch: Partial<Habit> = {}): Habit => ({
  id: '00000000-0000-4000-8000-000000000001',
  name: 'Read',
  category: 'reading',
  frequency: 'daily',
  startDate: '2026-09-01',
  position: 0,
  createdAt: '2026-09-01T08:00:00.000Z',
  updatedAt: '2026-09-01T08:00:00.000Z',
  ...patch,
});

const entry = (date: string, status: HabitEntry['status']): HabitEntry => ({
  id: `00000000-0000-4000-8000-${date.replace(/-/g, '').padStart(12, '0')}`,
  habitId: '00000000-0000-4000-8000-000000000001',
  date,
  status,
  tags: [],
  createdAt: `${date}T08:00:00.000Z`,
  updatedAt: `${date}T08:00:00.000Z`,
});

describe('habit history', () => {
  it('names the next streak milestone', () => {
    expect(nextMilestone(0)).toBe(3);
    expect(nextMilestone(3)).toBe(7);
    expect(nextMilestone(29)).toBe(30);
    expect(nextMilestone(365)).toBeUndefined();
  });

  it('finds the strongest weekday, needing three counted occurrences and ignoring skips', () => {
    const o = (start: string, status: Occurrence['status']): Occurrence => ({
      start,
      end: start,
      status,
    });
    // Mondays: 3 of 3 done. Tuesdays: 2 of 3. Wednesdays: only 2 counted, so not eligible.
    const occurrences = [
      o('2026-09-07', 'completed'),
      o('2026-09-14', 'completed'),
      o('2026-09-21', 'completed'),
      o('2026-09-08', 'completed'),
      o('2026-09-15', 'missed'),
      o('2026-09-22', 'completed'),
      o('2026-09-09', 'completed'),
      o('2026-09-16', 'completed'),
      o('2026-09-23', 'skipped'),
    ];
    expect(strongestWeekday(occurrences)).toEqual({ weekday: 1, rate: 1 });
    expect(strongestWeekday(occurrences.slice(6))).toBeUndefined();
  });

  it('reads days like the calendar: weekly habits never miss a single day', () => {
    expect(dayState(habit(), undefined, '2026-10-01', '2026-10-02')).toBe('missed');
    expect(dayState(habit(), undefined, '2026-10-02', '2026-10-02')).toBe('pending');
    expect(dayState(habit(), undefined, '2026-08-31', '2026-10-02')).toBe('unscheduled');
    expect(dayState(habit({ frequency: 'weekly' }), undefined, '2026-10-01', '2026-10-02')).toBe(
      'unscheduled',
    );
  });

  it('builds a weekly trend and a whole-week heatmap ending this week', () => {
    const entries = [entry('2026-09-28', 'completed'), entry('2026-09-29', 'completed')];
    // Friday Oct 2, weeks starting Monday. This week: Mon and Tue done, Wed and Thu missed.
    const trend = weeklyTrend(habit(), entries, '2026-10-02', '2026-10-02', 1, 2);
    expect(trend.map((w) => w.start)).toEqual(['2026-09-21', '2026-09-28']);
    expect(trend[1]).toMatchObject({ completed: 2, rate: 0.5 });

    const days = heatmapDays(habit(), entries, '2026-10-02', 1, 2);
    expect(days).toHaveLength(14);
    expect(days.at(-1)).toEqual({ date: '2026-10-04', state: 'future' });
    expect(days.find((d) => d.date === '2026-09-28')?.state).toBe('completed');
  });
});
