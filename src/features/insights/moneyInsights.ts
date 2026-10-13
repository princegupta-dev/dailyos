import { categoryLabel } from '@/domain/finance';
import { formatINR, ratio } from '@/lib/money';
import type { RangeSummary } from '@/services/analytics.service';
import {
  budgetStatuses,
  dueRecurring,
  goalProgress,
  inRange,
  liabilityIds,
  savingsSummary,
  spendingChanges,
  totalsOf,
  yearOf,
  type FinanceData,
  type FlowTotals,
  type GroupChange,
} from '@/services/finance.service';
import type { InsightPeriod, Suggestion } from './insightsModel';

/*
 * Money insights for the Insights screen: the same period and comparison as habits, so the
 * two can be read together. Pure functions over loaded records, like insightsModel.ts.
 */

export interface MoneyPeriod {
  current: FlowTotals;
  previous: FlowTotals;
  /** Spending groups that moved most between the periods. */
  changes: GroupChange[];
}

export function moneyPeriod(data: FinanceData, period: InsightPeriod): MoneyPeriod {
  const liabilities = liabilityIds(data.accounts);
  const now = inRange(data.entries, { from: period.from, to: period.to });
  const before = inRange(data.entries, { from: period.prevFrom, to: period.prevTo });
  return {
    current: totalsOf(now, liabilities),
    previous: totalsOf(before, liabilities),
    changes: spendingChanges(now, before, data.categories),
  };
}

/** Relative change, or null when there's nothing to compare against. */
export function relativeChange(current: number, previous: number): number | null {
  return previous === 0 ? null : (current - previous) / previous;
}

/** A change has to be this large, in share and in rupees, before it's called out. */
const NOTABLE_SHARE = 0.2;
const NOTABLE_PAISE = 1_000_00;
const HEALTHY_SAVINGS_RATE = 0.2;
const LOW_EMERGENCY_MONTHS = 3;

/**
 * Kind, specific money suggestions, each shown only when the numbers support it: a spending
 * group that jumped, a healthy (or negative) savings rate, an overspent budget, a goal falling
 * behind, payments due, and a thin emergency fund.
 */
export function moneySuggestions(input: {
  data: FinanceData;
  money: MoneyPeriod;
  period: InsightPeriod;
  today: string;
  emergencyFundMonths?: number | undefined;
}): Suggestion[] {
  const { data, money, period, today } = input;
  const out: Suggestion[] = [];
  const { current, changes } = money;

  const rising = changes.find(
    (c) =>
      c.change >= NOTABLE_PAISE &&
      c.previous > 0 &&
      (relativeChange(c.current, c.previous) ?? 0) >= NOTABLE_SHARE,
  );
  if (rising) {
    out.push({
      id: 'money-rising',
      tone: 'care',
      title: `${rising.label} spending is up ${Math.round((relativeChange(rising.current, rising.previous) ?? 0) * 100)}%`,
      body: `${formatINR(rising.current)} ${period.name}, against ${formatINR(rising.previous)} ${period.prevName}. Worth a look before it becomes the new normal.`,
      action: {
        label: 'See transactions',
        to: `/investments/activity?kind=expense&category=${encodeURIComponent(rising.category)}`,
      },
    });
  }

  if (current.savingsRate !== null && current.income > 0) {
    if (current.savingsRate < 0) {
      out.push({
        id: 'money-negative',
        tone: 'care',
        title: 'You spent more than you earned',
        body: `Spending was ${formatINR(current.expenses)} on ${formatINR(current.income)} of income ${period.name}. One category to trim is often enough.`,
        action: { label: 'Open budgets', to: '/investments/budgets' },
      });
    } else if (current.savingsRate >= HEALTHY_SAVINGS_RATE) {
      out.push({
        id: 'money-saving',
        tone: 'celebrate',
        title: `You kept ${Math.round(current.savingsRate * 100)}% of your income`,
        body: `${formatINR(current.surplus)} not spent ${period.name}. Putting it to work keeps it from drifting away.`,
      });
    }
  }

  const over = budgetStatuses(data.budgets, data.entries, today, data.categories).find(
    (b) => b.state === 'over' && b.budget.period === 'monthly',
  );
  if (over) {
    out.push({
      id: 'money-budget',
      tone: 'care',
      title: `${categoryLabel('expense', over.budget.category, data.categories)} is over budget`,
      body: `${formatINR(-over.remaining)} past the ${formatINR(over.budget.limit)} limit this month.`,
      action: { label: 'Open budgets', to: '/investments/budgets' },
    });
  }

  const behind = data.goals
    .filter((g) => g.year === yearOf(today) && g.kind !== 'spending')
    .map((g) => goalProgress(g, data.entries, today))
    .find((g) => g.state === 'behind' && g.perMonth !== null);
  if (behind && behind.perMonth !== null) {
    out.push({
      id: 'money-goal',
      tone: 'idea',
      title: `“${behind.goal.name}” needs ${formatINR(behind.perMonth)} a month`,
      body: `${formatINR(behind.remaining)} to go by the deadline. A recurring transfer makes it automatic.`,
      action: { label: 'See goals', to: '/investments/goals' },
    });
  }

  const due = dueRecurring(data.recurring, today);
  if (due.length > 0) {
    out.push({
      id: 'money-due',
      tone: 'idea',
      title: `${due.length} recurring ${due.length === 1 ? 'payment is' : 'payments are'} due`,
      body: 'Record them so balances and budgets stay accurate.',
      action: { label: 'Open recurring', to: '/investments/recurring' },
    });
  }

  const savings = savingsSummary(data, today, input.emergencyFundMonths);
  if (
    savings.emergencyMonths !== null &&
    savings.emergencyMonths < Math.min(LOW_EMERGENCY_MONTHS, savings.targetMonths)
  ) {
    out.push({
      id: 'money-emergency',
      tone: 'idea',
      title: 'Build a little more cushion',
      body: `Your emergency fund covers ${savings.emergencyMonths.toFixed(1)} months of expenses. Three is a good first milestone.`,
      action: { label: 'See savings', to: '/investments/accounts' },
    });
  }

  return out.slice(0, 4);
}

/* ---------- Habits and money together ---------- */

export interface HabitMoneyWeek {
  from: string;
  /** Habit follow-through that week, or null when nothing was due. */
  habitRate: number | null;
  /** Spending that week. */
  spent: number;
}

export interface HabitMoneyComparison {
  weeks: HabitMoneyWeek[];
  /** Average weekly spending in the stronger and weaker habit weeks (split at the median). */
  strong: number | null;
  weak: number | null;
}

/**
 * Habit consistency beside spending, week by week. Not a claim of cause: just a mirror, to see
 * whether steadier weeks also tend to be calmer for money.
 */
export function habitsAndMoney(
  weeks: readonly RangeSummary[],
  data: FinanceData,
): HabitMoneyComparison {
  const rows = weeks.map((w) => ({
    from: w.from,
    habitRate: w.habits.overall.rate,
    spent: totalsOf(inRange(data.entries, { from: w.from, to: w.to })).expenses,
  }));
  const rated = rows.filter(
    (r): r is HabitMoneyWeek & { habitRate: number } => r.habitRate !== null,
  );
  if (rated.length < 4 || rated.every((r) => r.spent === 0)) {
    return { weeks: rows, strong: null, weak: null };
  }
  const sorted = [...rated].sort((a, b) => a.habitRate - b.habitRate);
  const half = Math.floor(sorted.length / 2);
  const average = (list: readonly HabitMoneyWeek[]) =>
    list.length === 0 ? null : Math.round(list.reduce((s, r) => s + r.spent, 0) / list.length);
  return {
    weeks: rows,
    weak: average(sorted.slice(0, half)),
    strong: average(sorted.slice(sorted.length - half)),
  };
}

/** One sentence comparing spending in strong and weak habit weeks, or null without enough data. */
export function habitsAndMoneyStory(comparison: HabitMoneyComparison): string | null {
  const { strong, weak } = comparison;
  if (strong === null || weak === null) return null;
  const change = ratio(strong - weak, weak);
  if (change === null || Math.abs(change) < 0.1) {
    return 'Your spending stays about the same whether habits go well or not.';
  }
  return change < 0
    ? `In your steadier habit weeks you spent ${Math.round(-change * 100)}% less (${formatINR(strong)} vs ${formatINR(weak)} a week).`
    : `In your steadier habit weeks you spent ${Math.round(change * 100)}% more (${formatINR(strong)} vs ${formatINR(weak)} a week).`;
}
