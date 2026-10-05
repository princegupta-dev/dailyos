import { describe, expect, it } from 'vitest';
import {
  achievements,
  headline,
  insightPeriod,
  momentumScore,
  pointsChange,
  suggestions,
  trendOf,
  weekdayExtremes,
  weekdayPattern,
} from '@/features/insights/insightsModel';
import type { RangeSummary } from '@/services/analytics.service';

function summary(overrides: {
  habitRate?: number | null;
  planRate?: number | null;
  perHabit?: RangeSummary['habits']['perHabit'];
}): RangeSummary {
  return {
    from: '2026-10-01',
    to: '2026-10-07',
    tasksCompleted: 0,
    plan: {
      planned: 0,
      // A rate implies at least one settled task.
      done: overrides.planRate == null ? 0 : 1,
      notDone: 0,
      open: 0,
      rescheduled: 0,
      cancelled: 0,
      completionRate: overrides.planRate ?? null,
    },
    outcomes: { set: 0, done: 0 },
    habits: {
      overall: {
        completed: 0,
        skipped: 0,
        missed: 0,
        pending: 0,
        rate: overrides.habitRate ?? null,
      },
      perHabit: overrides.perHabit ?? [],
    },
    learning: { count: 0, topics: [] },
    ratings: { average: null, count: 0 },
    blockers: [],
  };
}

describe('insight periods', () => {
  it('compares a partial week with the same days last week', () => {
    // Wednesday, weeks starting Monday.
    expect(insightPeriod('week', '2026-10-07', 1)).toMatchObject({
      from: '2026-10-05',
      to: '2026-10-07',
      prevFrom: '2026-09-28',
      prevTo: '2026-09-30',
    });
  });

  it('clips last month to its own length', () => {
    expect(insightPeriod('month', '2026-03-31', 1)).toMatchObject({
      from: '2026-03-01',
      prevFrom: '2026-02-01',
      prevTo: '2026-02-28',
    });
  });

  it('uses two back-to-back 90-day windows', () => {
    const p = insightPeriod('quarter', '2026-10-07', 1);
    expect(p.from).toBe('2026-07-10');
    expect(p.prevTo).toBe('2026-07-09');
  });
});

describe('score and trends', () => {
  it('averages only the parts with data', () => {
    expect(momentumScore(summary({ habitRate: 0.8, planRate: 0.6 }))).toBe(70);
    expect(momentumScore(summary({ habitRate: 0.5 }))).toBe(50);
    expect(momentumScore(summary({}))).toBeNull();
  });

  it('leaves the plan out while every planned task is still open', () => {
    const s = summary({ habitRate: 0.5 });
    s.plan = { ...s.plan, planned: 2, open: 2, completionRate: 0 };
    expect(momentumScore(s)).toBe(50);
  });

  it('treats small changes as steady', () => {
    expect(pointsChange(0.72, 0.6)).toBe(12);
    expect(trendOf(12)).toBe('up');
    expect(trendOf(-2)).toBe('flat');
    expect(trendOf(null)).toBeNull();
  });

  it('leads the headline with a notable rise', () => {
    const period = insightPeriod('week', '2026-10-07', 1);
    expect(headline(summary({ habitRate: 0.9 }), summary({ habitRate: 0.6 }), period)).toBe(
      'Habits are up 30 points on last week.',
    );
  });
});

describe('weekday pattern', () => {
  it('rates each weekday and leaves weekly habits out', () => {
    const occurrences = new Map([
      [
        'a',
        [
          { start: '2026-09-28', end: '2026-09-28', status: 'completed' as const }, // Mon
          { start: '2026-10-05', end: '2026-10-05', status: 'completed' as const }, // Mon
          { start: '2026-10-02', end: '2026-10-02', status: 'missed' as const }, // Fri
        ],
      ],
      ['w', [{ start: '2026-09-28', end: '2026-10-04', status: 'missed' as const }]],
    ]);
    const pattern = weekdayPattern(
      occurrences,
      [
        { id: 'a', frequency: 'daily' },
        { id: 'w', frequency: 'weekly' },
      ],
      1,
    );
    expect(pattern[0]).toMatchObject({ weekday: 1, completed: 2, counted: 2, rate: 1 });
    expect(pattern[4]).toMatchObject({ weekday: 5, completed: 0, counted: 1, rate: 0 });
    expect(weekdayExtremes(pattern, 1)).toMatchObject({
      best: { weekday: 1 },
      worst: { weekday: 5 },
    });
  });
});

describe('achievements', () => {
  it('shows recent milestones earned and the next one to reach', () => {
    const list = achievements([{ currentStreak: 3, longestStreak: 25, totalCompletions: 60 }]);
    expect(list.map((a) => [a.id, a.earned])).toEqual([
      ['streak-7', true],
      ['streak-21', true],
      ['streak-50', false],
      ['checkins-10', true],
      ['checkins-50', true],
      ['checkins-100', false],
    ]);
  });
});

describe('suggestions', () => {
  it('celebrates the strongest habit and offers the minimum for the weakest', () => {
    const current = summary({
      habitRate: 0.6,
      perHabit: [
        {
          habitId: 'run',
          name: 'Run',
          summary: { completed: 6, missed: 0, skipped: 0, pending: 0, rate: 1 },
        },
        {
          habitId: 'read',
          name: 'Read',
          summary: { completed: 1, missed: 4, skipped: 0, pending: 0, rate: 0.2 },
        },
      ],
    });
    const list = suggestions({
      current,
      previous: summary({ habitRate: 0.55 }),
      period: insightPeriod('week', '2026-10-07', 1),
      habits: [{ id: 'read', name: 'Read', minimumTarget: 'One page' }],
      extremes: null,
    });
    expect(list.map((s) => s.id)).toEqual(['strongest', 'weakest']);
    expect(list[1]?.body).toContain('“One page” still counts');
  });
});
