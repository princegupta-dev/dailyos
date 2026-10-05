import type { Habit, HabitStats, Occurrence } from '@/domain/habit';
import {
  addDays,
  addMonths,
  daysBetween,
  endOfMonth,
  startOfMonth,
  startOfWeek,
  weekdayOf,
} from '@/lib/dates';
import type { RangeSummary } from '@/services/analytics.service';

/* ---------- Periods ---------- */

export type PeriodKind = 'week' | 'month' | 'quarter';

export interface InsightPeriod {
  from: string;
  to: string;
  /** The same stretch of time one period earlier, for fair comparisons. */
  prevFrom: string;
  prevTo: string;
  /** "this week", "this month", "the last 90 days". */
  name: string;
  /** "last week", "last month", "the 90 days before". */
  prevName: string;
}

const QUARTER_DAYS = 90;

/**
 * The chosen period up to today, and the matching stretch before it. A week compares Monday
 * to today with the same days last week, so a Wednesday is never judged against a full week.
 */
export function insightPeriod(
  kind: PeriodKind,
  today: string,
  weekStartsOn: number,
): InsightPeriod {
  if (kind === 'week') {
    const from = startOfWeek(today, weekStartsOn);
    return {
      from,
      to: today,
      prevFrom: addDays(from, -7),
      prevTo: addDays(today, -7),
      name: 'this week',
      prevName: 'last week',
    };
  }
  if (kind === 'month') {
    const from = startOfMonth(today);
    const prevFrom = addMonths(from, -1);
    const sameDay = addDays(prevFrom, daysBetween(from, today));
    const prevEnd = endOfMonth(prevFrom);
    return {
      from,
      to: today,
      prevFrom,
      prevTo: sameDay < prevEnd ? sameDay : prevEnd,
      name: 'this month',
      prevName: 'last month',
    };
  }
  const from = addDays(today, -(QUARTER_DAYS - 1));
  return {
    from,
    to: today,
    prevFrom: addDays(from, -QUARTER_DAYS),
    prevTo: addDays(from, -1),
    name: 'the last 90 days',
    prevName: 'the 90 days before',
  };
}

/* ---------- Score and comparisons ---------- */

/**
 * One number for the period: the average of habit consistency and plan kept, using only the
 * parts with data. Null when neither has anything to count yet.
 */
export function momentumScore(summary: RangeSummary): number | null {
  const parts = [summary.habits.overall.rate, planRate(summary)].filter(
    (r): r is number => r !== null,
  );
  if (parts.length === 0) return null;
  return Math.round((parts.reduce((a, b) => a + b, 0) / parts.length) * 100);
}

/**
 * Plan kept, once at least one planned task has been settled (finished or missed). While
 * every planned task is still open — this morning, say — there's nothing fair to show yet.
 */
export function planRate(summary: RangeSummary): number | null {
  const { done, notDone, completionRate } = summary.plan;
  return done + notDone === 0 ? null : completionRate;
}

/** Change in percentage points between two rates, or null when either is missing. */
export function pointsChange(current: number | null, previous: number | null): number | null {
  if (current === null || previous === null) return null;
  return Math.round(current * 100) - Math.round(previous * 100);
}

export type Trend = 'up' | 'down' | 'flat';

/** Changes of a couple of points are noise, so they read as steady. */
export function trendOf(change: number | null, threshold = 3): Trend | null {
  if (change === null) return null;
  if (change >= threshold) return 'up';
  if (change <= -threshold) return 'down';
  return 'flat';
}

/** A short, plain sentence summing up the period, leading with the most notable change. */
export function headline(
  current: RangeSummary,
  previous: RangeSummary,
  period: InsightPeriod,
): string {
  const habits = pointsChange(current.habits.overall.rate, previous.habits.overall.rate);
  const plan = pointsChange(planRate(current), planRate(previous));
  const habitRate = current.habits.overall.rate;
  if (habits !== null && habits >= 10)
    return `Habits are up ${habits} points on ${period.prevName}.`;
  if (plan !== null && plan >= 10)
    return `You’re keeping more of your plan than ${period.prevName}.`;
  if (habitRate !== null && habitRate >= 0.8)
    return `A strong run: ${Math.round(habitRate * 100)}% of habits done ${period.name}.`;
  if (habits !== null && habits <= -10)
    return `Habits dipped ${-habits} points on ${period.prevName}. Small steps bring them back.`;
  if (habitRate !== null) return `${Math.round(habitRate * 100)}% of habits done ${period.name}.`;
  if (current.tasksCompleted > 0) return `${current.tasksCompleted} tasks finished ${period.name}.`;
  return `Nothing recorded ${period.name} yet. Your first check-in starts the story.`;
}

/* ---------- Weekday pattern ---------- */

export interface WeekdayRate {
  /** 0 = Sunday. */
  weekday: number;
  completed: number;
  /** Completed plus missed: skipped and pending days don't count against you. */
  counted: number;
  rate: number | null;
}

/**
 * Habit follow-through by day of the week, across every habit scheduled on particular days.
 * Weekly habits are left out: a week isn't tied to one day. Ordered from the week's first day.
 */
export function weekdayPattern(
  occurrences: ReadonlyMap<string, readonly Occurrence[]>,
  habits: readonly Pick<Habit, 'id' | 'frequency'>[],
  weekStartsOn: number,
): WeekdayRate[] {
  const days = Array.from({ length: 7 }, (_, i) => ({
    weekday: (weekStartsOn + i) % 7,
    completed: 0,
    counted: 0,
    rate: null as number | null,
  }));
  for (const habit of habits) {
    if (habit.frequency === 'weekly') continue;
    for (const o of occurrences.get(habit.id) ?? []) {
      if (o.status !== 'completed' && o.status !== 'missed') continue;
      const day = days.find((d) => d.weekday === weekdayOf(o.start));
      if (!day) continue;
      day.counted += 1;
      if (o.status === 'completed') day.completed += 1;
    }
  }
  return days.map((d) => ({ ...d, rate: d.counted === 0 ? null : d.completed / d.counted }));
}

/** Best and hardest days, once each has enough history (three occurrences) to mean something. */
export function weekdayExtremes(pattern: readonly WeekdayRate[], minimum = 3) {
  const ranked = pattern
    .filter((d): d is WeekdayRate & { rate: number } => d.rate !== null && d.counted >= minimum)
    .sort((a, b) => b.rate - a.rate);
  const best = ranked[0];
  const worst = ranked.at(-1);
  if (!best || !worst || best === worst || best.rate - worst.rate < 0.15) return null;
  return { best, worst };
}

/* ---------- Achievements ---------- */

export interface Achievement {
  id: string;
  title: string;
  description: string;
  earned: boolean;
  /** Progress toward the goal, when not yet earned. */
  value: number;
  goal: number;
}

const STREAK_GOALS = [7, 21, 50, 100] as const;
const CHECK_IN_GOALS = [10, 50, 100, 250, 500] as const;

/**
 * Milestones from habit history: the longest streak reached and total check-ins. Shows what's
 * been earned and the next goal for each, so there is always one thing to reach for.
 */
export function achievements(stats: readonly HabitStats[]): Achievement[] {
  const longest = Math.max(0, ...stats.map((s) => s.longestStreak));
  const total = stats.reduce((sum, s) => sum + s.totalCompletions, 0);
  const ladder = (
    goals: readonly number[],
    value: number,
    make: (goal: number) => Pick<Achievement, 'id' | 'title' | 'description'>,
  ): Achievement[] => {
    const earned = goals.filter((g) => value >= g);
    const next = goals.find((g) => value < g);
    const shown = [...earned.slice(-2), ...(next === undefined ? [] : [next])];
    return shown.map((goal) => ({ ...make(goal), earned: value >= goal, value, goal }));
  };
  return [
    ...ladder(STREAK_GOALS, longest, (g) => ({
      id: `streak-${g}`,
      title: `${g}-day streak`,
      description: `Kept one habit going ${g} times in a row`,
    })),
    ...ladder(CHECK_IN_GOALS, total, (g) => ({
      id: `checkins-${g}`,
      title: `${g} check-ins`,
      description: `${g} habit completions in all`,
    })),
  ];
}

/* ---------- Suggestions ---------- */

export type SuggestionTone = 'celebrate' | 'care' | 'idea';

export interface Suggestion {
  id: string;
  tone: SuggestionTone;
  title: string;
  body: string;
  action?: { label: string; to: string } | undefined;
}

const WEEKDAY_NAMES = [
  'Sundays',
  'Mondays',
  'Tuesdays',
  'Wednesdays',
  'Thursdays',
  'Fridays',
  'Saturdays',
];

/**
 * A few kind, specific suggestions drawn from the numbers: something to celebrate, something
 * that needs care, and one idea to try. Each is shown only when the data supports it.
 */
export function suggestions(input: {
  current: RangeSummary;
  previous: RangeSummary;
  period: InsightPeriod;
  habits: readonly Pick<Habit, 'id' | 'name' | 'minimumTarget'>[];
  extremes: ReturnType<typeof weekdayExtremes>;
}): Suggestion[] {
  const { current, previous, period, habits, extremes } = input;
  const out: Suggestion[] = [];

  const ranked = current.habits.perHabit
    .filter((h) => h.summary.rate !== null && h.summary.completed + h.summary.missed >= 3)
    .sort((a, b) => (b.summary.rate ?? 0) - (a.summary.rate ?? 0));
  const strongest = ranked[0];
  const weakest = ranked.at(-1);

  if (strongest && (strongest.summary.rate ?? 0) >= 0.8) {
    out.push({
      id: 'strongest',
      tone: 'celebrate',
      title: `${strongest.name} is part of you now`,
      body: `${Math.round((strongest.summary.rate ?? 0) * 100)}% ${period.name}. Whatever makes it easy, keep it.`,
      action: { label: 'See habit', to: `/habits/${strongest.habitId}` },
    });
  }

  if (weakest && weakest !== strongest && (weakest.summary.rate ?? 1) < 0.5) {
    const habit = habits.find((h) => h.id === weakest.habitId);
    out.push({
      id: 'weakest',
      tone: 'care',
      title: `${weakest.name} needs a smaller step`,
      body: habit?.minimumTarget
        ? `Done ${weakest.summary.completed} of ${weakest.summary.completed + weakest.summary.missed} times. On hard days, “${habit.minimumTarget}” still counts.`
        : `Done ${weakest.summary.completed} of ${weakest.summary.completed + weakest.summary.missed} times. A hard-day minimum or fewer days could help it stick.`,
      action: { label: 'Adjust habit', to: `/habits/${weakest.habitId}` },
    });
  }

  if (extremes) {
    out.push({
      id: 'weekday',
      tone: 'idea',
      title: `${WEEKDAY_NAMES[extremes.worst.weekday] ?? 'Some days'} are your hardest`,
      body: `${Math.round(extremes.worst.rate * 100)}% follow-through, against ${Math.round(extremes.best.rate * 100)}% on ${WEEKDAY_NAMES[extremes.best.weekday] ?? 'your best day'}. Plan lighter there.`,
    });
  }

  const plan = current.plan;
  if (plan.completionRate !== null && plan.planned >= 3 && plan.completionRate < 0.5) {
    out.push({
      id: 'plan',
      tone: 'care',
      title: 'Plan a little less',
      body: `You finished ${plan.done} of ${plan.done + plan.notDone + plan.open} planned tasks. Fewer, clearer outcomes are easier to keep.`,
      action: { label: 'Open tasks', to: '/tasks' },
    });
  } else if (plan.rescheduled >= 3) {
    out.push({
      id: 'rescheduled',
      tone: 'idea',
      title: `${plan.rescheduled} tasks moved on`,
      body: 'Rescheduling is fine. If the same ones keep moving, maybe they need a smaller first step.',
      action: { label: 'Open tasks', to: '/tasks' },
    });
  }

  const blocker = current.blockers.find((b) => b.dates.length >= 2);
  if (blocker) {
    out.push({
      id: 'blocker',
      tone: 'care',
      title: 'A blocker keeps coming back',
      body: `“${blocker.text}” came up ${blocker.dates.length} times. Worth a plan in your next review.`,
      action: { label: 'Go to Review', to: '/review' },
    });
  }

  const habitsChange = pointsChange(current.habits.overall.rate, previous.habits.overall.rate);
  if (habitsChange !== null && habitsChange >= 10 && !out.some((s) => s.tone === 'celebrate')) {
    out.push({
      id: 'improving',
      tone: 'celebrate',
      title: 'You’re building momentum',
      body: `Habits are up ${habitsChange} points on ${period.prevName}.`,
    });
  }

  return out.slice(0, 4);
}
