import { db } from '@/db/database';
import type { HabitIconKey, HabitTone } from '@/domain/appearance';
import type { HabitCategory } from '@/domain/categories';
import {
  habitOccurrences,
  occurrenceFor,
  summarizeOccurrences,
  type Habit,
  type HabitEntry,
  type OccurrenceStatus,
  type OccurrenceSummary,
} from '@/domain/habit';
import { groupTopics, normalizeForSearch, type LearningEntry } from '@/domain/learning';
import {
  derivePlanItemOutcome,
  type DailyPlan,
  type Outcome,
  type PlanItem,
  type PlanItemOutcome,
} from '@/domain/plan';
import type { ItemReflection } from '@/domain/reflection';
import type { Review } from '@/domain/review';
import { statusAtEndOf, type Task, type TaskEvent } from '@/domain/task';
import { groupBy } from '@/lib/collections';
import { addDays, startOfWeek } from '@/lib/dates';

/**
 * Review summaries are computed on demand from the underlying records and never stored, so
 * they can't drift from the data. Everything below the loader is pure and unit-tested
 * directly.
 */

export interface PeriodRecords {
  plans: DailyPlan[];
  planItems: PlanItem[];
  tasks: Map<string, Task>;
  /** Full history of every task in `tasks`, needed to rebuild past statuses. */
  eventsByTask: Map<string, TaskEvent[]>;
  /** Events whose local date falls in the range. */
  eventsInRange: TaskEvent[];
  habits: Habit[];
  habitEntries: HabitEntry[];
  learning: LearningEntry[];
  dailyReviews: Review[];
  /** Per-habit and per-task reflections from daily reviews. */
  itemReflections: ItemReflection[];
}

/**
 * Loads every record a summary for [from, to] needs. All reads are direct Dexie calls in one
 * function so the result can be used inside a live query.
 */
export async function loadPeriodRecords(from: string, to: string): Promise<PeriodRecords> {
  const plans = await db.dailyPlans.where('date').between(from, to, true, true).toArray();
  const planItems = (
    await db.planItems.where('date').between(from, to, true, true).toArray()
  ).filter((i) => i.removedAt === undefined);
  const eventsInRange = await db.taskEvents
    .where('localDate')
    .between(from, to, true, true)
    .toArray();
  const taskIds = [
    ...new Set([...planItems.map((i) => i.taskId), ...eventsInRange.map((e) => e.taskId)]),
  ];
  const tasks = await db.tasks.bulkGet(taskIds);
  const allEvents = await db.taskEvents.where('taskId').anyOf(taskIds).toArray();
  const habits = (await db.habits.toArray()).sort((a, b) => a.position - b.position);
  // Weekly occurrences starting near the end of the range extend up to six days past it.
  const habitEntries = await db.habitEntries
    .where('date')
    .between(from, addDays(to, 6), true, true)
    .toArray();
  const learning = (
    await db.learningEntries.where('capturedDate').between(from, to, true, true).toArray()
  ).filter((e) => e.archivedAt === undefined);
  const dailyReviews = (
    await db.reviews.where('periodStart').between(from, to, true, true).toArray()
  ).filter((r) => r.periodType === 'daily');
  const itemReflections = await db.itemReflections
    .where('date')
    .between(from, to, true, true)
    .toArray();
  return {
    plans,
    planItems,
    tasks: new Map(tasks.flatMap((t) => (t ? [[t.id, t] as const] : []))),
    eventsByTask: groupBy(allEvents, (e) => e.taskId),
    eventsInRange,
    habits,
    habitEntries,
    learning,
    dailyReviews,
    itemReflections,
  };
}

/* ---------- Daily ---------- */

export interface PlannedResult {
  taskId: string;
  /** Title as planned (snapshot), not as later edited. */
  title: string;
  outcome: PlanItemOutcome;
  rescheduledTo?: string | undefined;
}

export interface PlanCounts {
  planned: number;
  done: number;
  notDone: number;
  open: number;
  rescheduled: number;
  cancelled: number;
  /** done / (done + notDone + open). Rescheduled and cancelled items are excluded. */
  completionRate: number | null;
}

export interface HabitResult {
  habitId: string;
  name: string;
  category: HabitCategory;
  icon?: HabitIconKey | undefined;
  tone?: HabitTone | undefined;
  status: OccurrenceStatus;
  weekly: boolean;
}

export interface DailySummary {
  date: string;
  intention: string;
  outcomes: Outcome[];
  planned: PlannedResult[];
  counts: PlanCounts;
  /** Tasks completed that day that weren't on the plan. */
  unplannedCompleted: { taskId: string; title: string }[];
  habits: HabitResult[];
  habitSummary: OccurrenceSummary;
  learning: { id: string; title: string; topic?: string | undefined }[];
}

function planResults(
  records: PeriodRecords,
  items: readonly PlanItem[],
  today: string,
): PlannedResult[] {
  return [...items]
    .sort((a, b) => a.date.localeCompare(b.date) || a.position - b.position)
    .map((item) => ({
      taskId: item.taskId,
      title: item.titleSnapshot,
      outcome: derivePlanItemOutcome(item, records.eventsByTask.get(item.taskId) ?? [], today),
      rescheduledTo: item.rescheduledTo,
    }));
}

export function countPlanResults(results: readonly PlannedResult[]): PlanCounts {
  const count = (outcome: PlanItemOutcome) => results.filter((r) => r.outcome === outcome).length;
  const done = count('done');
  const notDone = count('not_done');
  const open = count('open');
  const counted = done + notDone + open;
  return {
    planned: results.length,
    done,
    notDone,
    open,
    rescheduled: count('rescheduled'),
    cancelled: count('cancelled'),
    completionRate: counted === 0 ? null : done / counted,
  };
}

/**
 * Distinct tasks completed in [from, to] that were still done at the end of the range, in the
 * order they were (last) completed.
 */
function completedInRange(records: PeriodRecords, from: string, to: string): string[] {
  const lastCompletion = new Map<string, string>();
  for (const e of records.eventsInRange) {
    if (e.type !== 'completed' || e.localDate < from || e.localDate > to) continue;
    const previous = lastCompletion.get(e.taskId);
    if (previous === undefined || e.occurredAt > previous)
      lastCompletion.set(e.taskId, e.occurredAt);
  }
  return [...lastCompletion.entries()]
    .filter(([id]) => statusAtEndOf(to, records.eventsByTask.get(id) ?? []) === 'done')
    .sort(([, a], [, b]) => a.localeCompare(b))
    .map(([id]) => id);
}

export function computeDailySummary(
  records: PeriodRecords,
  date: string,
  today: string,
  weekStartsOn: number,
): DailySummary {
  const plan = records.plans.find((p) => p.date === date);
  const planned = planResults(
    records,
    records.planItems.filter((i) => i.date === date),
    today,
  );
  const plannedIds = new Set(planned.map((p) => p.taskId));

  const habitEntries = groupBy(records.habitEntries, (e) => e.habitId);
  const habits = records.habits.flatMap((habit): HabitResult[] => {
    const occurrence = occurrenceFor(
      habit,
      habitEntries.get(habit.id) ?? [],
      date,
      today,
      weekStartsOn,
    );
    return occurrence
      ? [
          {
            habitId: habit.id,
            name: habit.name,
            category: habit.category,
            icon: habit.icon,
            tone: habit.tone,
            status: occurrence.status,
            weekly: habit.frequency === 'weekly',
          },
        ]
      : [];
  });

  return {
    date,
    intention: plan?.intention ?? '',
    outcomes: plan?.topOutcomes ?? [],
    planned,
    counts: countPlanResults(planned),
    unplannedCompleted: completedInRange(records, date, date)
      .filter((id) => !plannedIds.has(id))
      .map((id) => ({ taskId: id, title: records.tasks.get(id)?.title ?? 'Unknown task' })),
    habits,
    habitSummary: summarizeOccurrences(
      habits.map((h) => ({ start: date, end: date, status: h.status })),
    ),
    learning: records.learning
      .filter((e) => e.capturedDate === date)
      .map((e) => ({ id: e.id, title: e.title, topic: e.topic })),
  };
}

/* ---------- Weekly and monthly ---------- */

export interface RecurringBlocker {
  text: string;
  dates: string[];
}

export interface RangeSummary {
  from: string;
  to: string;
  tasksCompleted: number;
  plan: PlanCounts;
  outcomes: { set: number; done: number };
  habits: {
    overall: OccurrenceSummary;
    perHabit: { habitId: string; name: string; summary: OccurrenceSummary }[];
  };
  learning: { count: number; topics: { topic: string; count: number }[] };
  /** Average day rating; `count` is the number of rated days. */
  ratings: { average: number | null; count: number };
  /** Blockers from daily reviews and reschedule notes, most frequent first. */
  blockers: RecurringBlocker[];
}

const BULLET = /^\s*(?:[-*•]|\d+[.)])\s*/;

/**
 * Groups blocker lines that say the same thing (ignoring case, accents, bullets, and
 * trailing punctuation) so repeated blockers stand out.
 */
export function groupBlockers(
  lines: readonly { date: string; text: string }[],
): RecurringBlocker[] {
  const groups = new Map<string, RecurringBlocker>();
  for (const { date, text } of lines) {
    const clean = text.replace(BULLET, '').trim();
    if (clean === '') continue;
    const key = normalizeForSearch(clean).replace(/[.!?,;:]+$/, '');
    const group = groups.get(key);
    if (group) {
      if (!group.dates.includes(date)) group.dates.push(date);
    } else {
      groups.set(key, { text: clean, dates: [date] });
    }
  }
  return [...groups.values()].sort(
    (a, b) =>
      b.dates.length - a.dates.length || (b.dates.at(-1) ?? '').localeCompare(a.dates.at(-1) ?? ''),
  );
}

/**
 * One rating per reviewed day. A day's rating is the average of its habit and task
 * ratings; days reviewed before those existed keep the single rating saved for the day.
 */
function dayRatings(reviews: readonly Review[], reflections: readonly ItemReflection[]): number[] {
  const byDate = new Map<string, number[]>();
  for (const r of reflections) {
    if (r.rating === undefined) continue;
    const list = byDate.get(r.date) ?? [];
    list.push(r.rating);
    byDate.set(r.date, list);
  }
  for (const review of reviews) {
    if (review.rating !== undefined && !byDate.has(review.periodStart)) {
      byDate.set(review.periodStart, [review.rating]);
    }
  }
  return [...byDate.values()].map((list) => list.reduce((sum, r) => sum + r, 0) / list.length);
}

export function computeRangeSummary(
  records: PeriodRecords,
  from: string,
  to: string,
  today: string,
  weekStartsOn: number,
): RangeSummary {
  const inRange = (date: string) => date >= from && date <= to;
  const planned = planResults(
    records,
    records.planItems.filter((i) => inRange(i.date)),
    today,
  );

  const entriesByHabit = groupBy(records.habitEntries, (e) => e.habitId);
  const perHabit = records.habits.flatMap((habit) => {
    const occurrences = habitOccurrences(
      habit,
      entriesByHabit.get(habit.id) ?? [],
      from,
      to,
      today,
      weekStartsOn,
    );
    return occurrences.length === 0
      ? []
      : [
          {
            habitId: habit.id,
            name: habit.name,
            occurrences,
            summary: summarizeOccurrences(occurrences),
          },
        ];
  });

  const learning = records.learning.filter((e) => inRange(e.capturedDate));

  const reviews = records.dailyReviews.filter((r) => inRange(r.periodStart));
  const reflections = records.itemReflections.filter((r) => inRange(r.date));
  const rated = dayRatings(reviews, reflections);
  const plans = records.plans.filter((p) => inRange(p.date));
  const outcomes = plans.flatMap((p) => p.topOutcomes);

  const blockerLines = [
    ...reviews.flatMap((r) =>
      r.blockers.split('\n').map((text) => ({ date: r.periodStart, text })),
    ),
    ...reflections.flatMap((r) =>
      (r.gotInTheWay ?? '').split('\n').map((text) => ({ date: r.date, text })),
    ),
    ...records.eventsInRange
      .filter((e) => e.type === 'rescheduled' && e.note !== undefined && inRange(e.localDate))
      .map((e) => ({ date: e.localDate, text: e.note ?? '' })),
  ].sort((a, b) => a.date.localeCompare(b.date));

  return {
    from,
    to,
    tasksCompleted: completedInRange(records, from, to).length,
    plan: countPlanResults(planned),
    outcomes: { set: outcomes.length, done: outcomes.filter((o) => o.done).length },
    habits: {
      overall: summarizeOccurrences(perHabit.flatMap((h) => h.occurrences)),
      perHabit: perHabit.map(({ habitId, name, summary }) => ({ habitId, name, summary })),
    },
    learning: {
      count: learning.length,
      topics: groupTopics(learning)
        .map(({ topic, count }) => ({ topic, count }))
        .sort((a, b) => b.count - a.count || a.topic.localeCompare(b.topic)),
    },
    ratings: {
      average: rated.length === 0 ? null : rated.reduce((sum, r) => sum + r, 0) / rated.length,
      count: rated.length,
    },
    blockers: groupBlockers(blockerLines),
  };
}

/**
 * Week-by-week breakdown of a month. Each week is clipped to the month, so the weeks add
 * up to the month's totals.
 */
export function computeWeeklyTrend(
  records: PeriodRecords,
  from: string,
  to: string,
  today: string,
  weekStartsOn: number,
): RangeSummary[] {
  const weeks: RangeSummary[] = [];
  for (
    let start = startOfWeek(from, weekStartsOn);
    start <= to && start <= today;
    start = addDays(start, 7)
  ) {
    const clippedFrom = start < from ? from : start;
    const end = addDays(start, 6);
    const clippedTo = end > to ? to : end;
    weeks.push(computeRangeSummary(records, clippedFrom, clippedTo, today, weekStartsOn));
  }
  return weeks;
}

/* ---------- Live-query entry points ---------- */

export async function getDailySummary(
  date: string,
  today: string,
  weekStartsOn: number,
): Promise<DailySummary> {
  return computeDailySummary(await loadPeriodRecords(date, date), date, today, weekStartsOn);
}

export interface RangeReport {
  summary: RangeSummary;
  /** Only for monthly reviews. */
  weeks?: RangeSummary[] | undefined;
}

export async function getRangeReport(
  from: string,
  to: string,
  today: string,
  weekStartsOn: number,
  withWeeks: boolean,
): Promise<RangeReport> {
  const records = await loadPeriodRecords(from, to);
  return {
    summary: computeRangeSummary(records, from, to, today, weekStartsOn),
    weeks: withWeeks ? computeWeeklyTrend(records, from, to, today, weekStartsOn) : undefined,
  };
}
