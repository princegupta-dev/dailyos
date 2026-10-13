import {
  ACCOUNT_TYPES,
  accountGroupOf,
  categoryLabel,
  EMERGENCY_FUND_MONTHS,
  expenseGroupLabel,
  expenseGroupOf,
  GROUP_PREFIX,
  SAVINGS_POTS,
  type Account,
  type AccountType,
  type Budget,
  type EntryKind,
  type FinanceCategory,
  type FinanceEntry,
  type FinanceGoal,
  type RecurringFrequency,
  type RecurringRule,
  type SalaryRecord,
  type SavingsPot,
} from '@/domain/finance';
import { groupBy } from '@/lib/collections';
import { addDays, addMonths, daysBetween, endOfMonth } from '@/lib/dates';
import { PAISE_PER_RUPEE, ratio } from '@/lib/money';

/*
 * Personal finance calculations. Pure functions over records already loaded (see
 * `getFinanceData` in db/repositories/finance.ts), so they can be tested directly and every
 * screen derives its numbers the same way. Amounts are paise throughout.
 *
 * Two views that never mix:
 *
 * Flows (what happened in a period), from entry kinds:
 *   surplus      = income − expenses                               (money not spent)
 *   unallocated  = surplus − net invested − net saved − debt repaid (cash not put anywhere)
 *   savings rate = surplus ÷ income
 *   Transfers are excluded from income and expenses. Transfers into a loan or card are
 *   reported separately as debt repaid.
 *
 * Balances (where money is now), from accounts:
 *   each account's value = its balance at its checkpoint + entries after the checkpoint
 *   net worth = bank & cash + savings + investments − loans & cards
 *   Money recorded without an account counts in the same buckets as "not in an account".
 */

export interface FinanceData {
  entries: FinanceEntry[];
  accounts: Account[];
  goals: FinanceGoal[];
  budgets: Budget[];
  salaries: SalaryRecord[];
  categories: FinanceCategory[];
  recurring: RecurringRule[];
}

export function isFinanceEmpty(data: FinanceData): boolean {
  return (
    data.entries.length === 0 &&
    data.accounts.length === 0 &&
    data.goals.length === 0 &&
    data.budgets.length === 0 &&
    data.salaries.length === 0 &&
    data.recurring.length === 0
  );
}

/** Paise rounded to whole rupees, for derived figures like averages where paise are noise. */
export function toWholeRupees(
  paise: number,
  round: (value: number) => number = Math.round,
): number {
  return round(paise / PAISE_PER_RUPEE) * PAISE_PER_RUPEE;
}

/* ---------- Periods ---------- */

export interface DateRange {
  from: string;
  to: string;
}

/** `YYYY-MM` for a date key. */
export function monthOf(date: string): string {
  return date.slice(0, 7);
}

export function monthRange(month: string): DateRange {
  const from = `${month}-01`;
  return { from, to: endOfMonth(from) };
}

export function yearRange(year: number): DateRange {
  return { from: `${year}-01-01`, to: `${year}-12-31` };
}

export function yearOf(date: string): number {
  return Number(date.slice(0, 4));
}

/** The `count` months ending with the month of `date`, oldest first. */
export function monthsEnding(date: string, count: number): string[] {
  const first = `${monthOf(date)}-01`;
  return Array.from({ length: count }, (_, i) => monthOf(addMonths(first, i - count + 1)));
}

/** Every month of `year`, January first. */
export function monthsOfYear(year: number): string[] {
  return Array.from({ length: 12 }, (_, i) => `${year}-${String(i + 1).padStart(2, '0')}`);
}

export function inRange(entries: readonly FinanceEntry[], range: DateRange): FinanceEntry[] {
  return entries.filter((e) => e.date >= range.from && e.date <= range.to);
}

/* ---------- Flows ---------- */

/** Deposits count up, withdrawals count down. */
export function signedAmount(entry: FinanceEntry): number {
  return entry.withdrawal ? -entry.amount : entry.amount;
}

/** Ids of loan and credit card accounts. A transfer into one is a debt repayment. */
export function liabilityIds(accounts: readonly Account[]): Set<string> {
  return new Set(accounts.filter((a) => accountGroupOf(a.type) === 'liability').map((a) => a.id));
}

/** True when an entry pays down a loan or card from one of your own accounts. */
export function isRepayment(entry: FinanceEntry, liabilities: ReadonlySet<string>): boolean {
  return (
    entry.kind === 'transfer' &&
    entry.toAccountId !== undefined &&
    liabilities.has(entry.toAccountId) &&
    !(entry.accountId !== undefined && liabilities.has(entry.accountId))
  );
}

export interface FlowTotals {
  income: number;
  expenses: number;
  /** Net money moved into investments (contributions − withdrawals). */
  invested: number;
  /** Net money moved into savings (deposits − withdrawals). */
  saved: number;
  /** Loan and card principal paid from your accounts. Not spending. */
  repaid: number;
  /** Other transfers between your own accounts; shown for reference, counted nowhere. */
  transferred: number;
  /** income − expenses. */
  surplus: number;
  /** surplus − invested − saved − repaid: cash not put anywhere. Negative means drawn down. */
  unallocated: number;
  /** surplus ÷ income, or null when there's no income. */
  savingsRate: number | null;
}

export function totalsOf(
  entries: readonly FinanceEntry[],
  liabilities: ReadonlySet<string> = new Set(),
): FlowTotals {
  const sums: Record<EntryKind | 'repaid', number> = {
    income: 0,
    expense: 0,
    investment: 0,
    saving: 0,
    transfer: 0,
    repaid: 0,
  };
  for (const entry of entries) {
    if (isRepayment(entry, liabilities)) sums.repaid += entry.amount;
    else sums[entry.kind] += signedAmount(entry);
  }
  const surplus = sums.income - sums.expense;
  return {
    income: sums.income,
    expenses: sums.expense,
    invested: sums.investment,
    saved: sums.saving,
    repaid: sums.repaid,
    transferred: sums.transfer,
    surplus,
    unallocated: surplus - sums.investment - sums.saving - sums.repaid,
    savingsRate: ratio(surplus, sums.income),
  };
}

export interface MonthTotals {
  month: string;
  totals: FlowTotals;
}

export function monthlyTotals(
  entries: readonly FinanceEntry[],
  months: readonly string[],
  liabilities: ReadonlySet<string> = new Set(),
): MonthTotals[] {
  const byMonth = groupBy(entries, (e) => monthOf(e.date));
  return months.map((month) => ({
    month,
    totals: totalsOf(byMonth.get(month) ?? [], liabilities),
  }));
}

export interface CumulativePoint {
  month: string;
  /** Net saved plus net invested in this month. */
  added: number;
  /** Running total of `added` up to and including this month, from all earlier history. */
  total: number;
}

/**
 * Wealth built month by month: savings and investments put away (net of withdrawals),
 * accumulated from the very first entry so the line starts at the real total.
 */
export function wealthTrend(
  entries: readonly FinanceEntry[],
  months: readonly string[],
): CumulativePoint[] {
  const first = months[0];
  if (first === undefined) return [];
  const before = totalsOf(entries.filter((e) => monthOf(e.date) < first));
  let running = before.saved + before.invested;
  return monthlyTotals(entries, months).map(({ month, totals }) => {
    const added = totals.saved + totals.invested;
    running += added;
    return { month, added, total: running };
  });
}

/* ---------- Breakdowns ---------- */

export interface CategoryAmount {
  category: string;
  label: string;
  amount: number;
  /** Share of the breakdown's total, 0–1. */
  share: number;
}

/** Totals by category for one kind, largest first. */
export function breakdownBy(
  entries: readonly FinanceEntry[],
  kind: 'income' | 'expense',
  categories: readonly FinanceCategory[],
): CategoryAmount[] {
  const own = entries.filter((e) => e.kind === kind);
  const total = own.reduce((sum, e) => sum + e.amount, 0);
  return [...groupBy(own, (e) => e.category)]
    .map(([category, rows]) => {
      const amount = rows.reduce((sum, e) => sum + e.amount, 0);
      return {
        category,
        label: categoryLabel(kind, category, categories),
        amount,
        share: ratio(amount, total) ?? 0,
      };
    })
    .sort((a, b) => b.amount - a.amount || a.label.localeCompare(b.label));
}

export interface GroupAmount extends CategoryAmount {
  /** The group's subcategories, largest first. */
  items: CategoryAmount[];
}

/** Expenses by group (Home, Food…), each with its subcategories. Keys are `group:<group>`. */
export function spendingByGroup(
  entries: readonly FinanceEntry[],
  categories: readonly FinanceCategory[],
): GroupAmount[] {
  const expenses = entries.filter((e) => e.kind === 'expense');
  const total = expenses.reduce((sum, e) => sum + e.amount, 0);
  return [...groupBy(expenses, (e) => expenseGroupOf(e.category, categories))]
    .map(([group, rows]) => {
      const amount = rows.reduce((sum, e) => sum + e.amount, 0);
      return {
        category: `${GROUP_PREFIX}${group}`,
        label: expenseGroupLabel(group, categories),
        amount,
        share: ratio(amount, total) ?? 0,
        items: breakdownBy(rows, 'expense', categories),
      };
    })
    .sort((a, b) => b.amount - a.amount || a.label.localeCompare(b.label));
}

export interface GroupChange {
  category: string;
  label: string;
  current: number;
  previous: number;
  /** current − previous. */
  change: number;
}

/** How each spending group moved between two periods, biggest absolute change first. */
export function spendingChanges(
  current: readonly FinanceEntry[],
  previous: readonly FinanceEntry[],
  categories: readonly FinanceCategory[],
): GroupChange[] {
  const now = new Map(spendingByGroup(current, categories).map((g) => [g.category, g]));
  const before = new Map(spendingByGroup(previous, categories).map((g) => [g.category, g]));
  return [...new Set([...now.keys(), ...before.keys()])]
    .map((category) => {
      const c = now.get(category)?.amount ?? 0;
      const p = before.get(category)?.amount ?? 0;
      return {
        category,
        label: now.get(category)?.label ?? before.get(category)?.label ?? 'Other',
        current: c,
        previous: p,
        change: c - p,
      };
    })
    .sort((a, b) => Math.abs(b.change) - Math.abs(a.change) || a.label.localeCompare(b.label));
}

/* ---------- Account balances ---------- */

/**
 * True when an entry moves an account's balance: it happened after the day the balance was
 * entered for, or on that day but was recorded after the balance was entered.
 */
export function entryAfterCheckpoint(
  entry: Pick<FinanceEntry, 'date' | 'createdAt'>,
  account: Pick<Account, 'asOf' | 'balanceSetAt'>,
): boolean {
  return (
    entry.date > account.asOf ||
    (entry.date === account.asOf && entry.createdAt > account.balanceSetAt)
  );
}

export interface AccountSummary {
  account: Account;
  /**
   * What it's worth now: the balance or value for bank, cash, and investments; the amount
   * owed for loans and cards. Use `signedValue` for sums.
   */
  value: number;
  /** Contribution to net worth: `value` for assets, −`value` for loans and cards. */
  signedValue: number;
  /** Investments: money put in so far (cost). */
  invested?: number | undefined;
  /** Investments: value − invested. */
  gain?: number | undefined;
  gainRate?: number | null | undefined;
  /** Investments: a market value was entered (rather than valued at cost). */
  valued: boolean;
}

/** Every account's current value as of `today`. */
export function accountSummaries(
  accounts: readonly Account[],
  entries: readonly FinanceEntry[],
  today: string,
): AccountSummary[] {
  const upToToday = entries.filter((e) => e.date <= today);
  const from = groupBy(
    upToToday.filter((e) => e.accountId !== undefined),
    (e) => e.accountId,
  );
  const to = groupBy(
    upToToday.filter((e) => e.toAccountId !== undefined),
    (e) => e.toAccountId,
  );
  return accounts.map((account) => {
    const after = (rows: readonly FinanceEntry[] | undefined) =>
      (rows ?? [])
        .filter((e) => entryAfterCheckpoint(e, account))
        .reduce((sum, e) => sum + e.amount, 0);
    // Money arriving raises an asset and pays down a liability; money leaving does the opposite.
    const movement = after(to.get(account.id)) - after(from.get(account.id));
    const group = accountGroupOf(account.type);
    if (group === 'liability') {
      const owed = account.balance - movement;
      return { account, value: owed, signedValue: -owed, valued: false };
    }
    const value = account.balance + movement;
    if (group === 'investment') {
      const invested = (account.invested ?? account.balance) + movement;
      return {
        account,
        value,
        signedValue: value,
        invested,
        gain: value - invested,
        gainRate: account.valuedOn ? ratio(value - invested, invested) : null,
        valued: account.valuedOn !== undefined,
      };
    }
    return { account, value, signedValue: value, valued: false };
  });
}

export interface Untracked {
  /** Everyday money recorded without an account. */
  cash: number;
  /** Savings recorded without a savings account, by pot. */
  savings: Record<SavingsPot, number>;
  /** Investments recorded without an investment account, at cost, by type. */
  investments: Map<AccountType, number>;
}

/** Money whose entries name no account on one side, so no account balance holds it. */
export function untrackedMoney(entries: readonly FinanceEntry[], today: string): Untracked {
  const result: Untracked = {
    cash: 0,
    savings: { general: 0, emergency: 0 },
    investments: new Map(),
  };
  for (const e of entries) {
    if (e.date > today) continue;
    const { amount } = e;
    switch (e.kind) {
      case 'income':
        if (!e.toAccountId) result.cash += amount;
        break;
      case 'expense':
        if (!e.accountId) result.cash -= amount;
        break;
      case 'investment':
      case 'saving': {
        const asset = e.withdrawal ? e.accountId : e.toAccountId;
        const everyday = e.withdrawal ? e.toAccountId : e.accountId;
        const delta = e.withdrawal ? -amount : amount;
        if (!everyday) result.cash -= delta;
        if (!asset) {
          if (e.kind === 'saving') {
            const pot = e.category as SavingsPot;
            result.savings[pot] += delta;
          } else {
            const type = e.category as AccountType;
            result.investments.set(type, (result.investments.get(type) ?? 0) + delta);
          }
        }
        break;
      }
      case 'transfer':
        break;
    }
  }
  return result;
}

export interface BalanceSheet {
  /** Bank accounts, cash, wallets, and kitties (not held as savings), plus untracked cash. */
  available: number;
  /** Savings accounts and savings recorded without an account. */
  savings: number;
  /** Investment value (market value where entered, cost otherwise). */
  investments: number;
  /** Owed on loans and cards. */
  liabilities: number;
  /** available + savings + investments − liabilities. */
  netWorth: number;
}

export function balanceSheet(data: FinanceData, today: string): BalanceSheet {
  const summaries = accountSummaries(data.accounts, data.entries, today);
  const untracked = untrackedMoney(data.entries, today);
  let available = untracked.cash;
  let savings = untracked.savings.general + untracked.savings.emergency;
  let investments = [...untracked.investments.values()].reduce((sum, v) => sum + v, 0);
  let liabilities = 0;
  for (const s of summaries) {
    const group = accountGroupOf(s.account.type);
    if (group === 'liability') liabilities += s.value;
    else if (group === 'investment') investments += s.value;
    else if (s.account.savingsPot) savings += s.value;
    else available += s.value;
  }
  return {
    available,
    savings,
    investments,
    liabilities,
    netWorth: available + savings + investments - liabilities,
  };
}

/* ---------- Portfolio ---------- */

export interface AllocationSlice {
  type: AccountType;
  value: number;
  share: number;
}

export interface PortfolioSummary {
  accounts: AccountSummary[];
  /** Invested without an investment account, counted at cost. */
  unassigned: number;
  invested: number;
  value: number;
  gain: number;
  gainRate: number | null;
  /** Value by investment type, in ACCOUNT_TYPES order, empty types left out. */
  allocation: AllocationSlice[];
}

export function portfolioSummary(data: FinanceData, today: string): PortfolioSummary {
  const summaries = accountSummaries(
    data.accounts.filter((a) => accountGroupOf(a.type) === 'investment'),
    data.entries,
    today,
  ).sort((a, b) => b.value - a.value || a.account.name.localeCompare(b.account.name));
  const untracked = untrackedMoney(data.entries, today).investments;
  const unassigned = [...untracked.values()].reduce((sum, v) => sum + v, 0);

  const byType = new Map<AccountType, number>(untracked);
  for (const s of summaries) {
    byType.set(s.account.type, (byType.get(s.account.type) ?? 0) + s.value);
  }
  const invested = summaries.reduce((sum, s) => sum + (s.invested ?? 0), 0) + unassigned;
  const value = summaries.reduce((sum, s) => sum + s.value, 0) + unassigned;
  const positive = ACCOUNT_TYPES.map((type) => ({ type, value: byType.get(type) ?? 0 })).filter(
    (s) => s.value > 0,
  );
  const allocationTotal = positive.reduce((sum, s) => sum + s.value, 0);
  return {
    accounts: summaries,
    unassigned,
    invested,
    value,
    gain: value - invested,
    gainRate: ratio(value - invested, invested),
    allocation: positive.map((s) => ({ ...s, share: ratio(s.value, allocationTotal) ?? 0 })),
  };
}

/* ---------- Savings ---------- */

export interface SavingsSummary {
  total: number;
  general: number;
  emergency: number;
  /** Net saved in the month of `today`. */
  thisMonth: number;
  /** Average monthly saving over the last three full months, or null without history. */
  monthlyAverage: number | null;
  /** Average monthly expenses over the last three months that had any, or null. */
  monthlyExpenses: number | null;
  /** Months of expenses the emergency fund covers, or null without expense history. */
  emergencyMonths: number | null;
  /** Suggested emergency fund: `targetMonths` of average expenses. */
  emergencyTarget: number | null;
  targetMonths: number;
}

const AVERAGE_MONTHS = 3;

export function savingsSummary(
  data: FinanceData,
  today: string,
  targetMonths: number = EMERGENCY_FUND_MONTHS,
): SavingsSummary {
  const upToToday = data.entries.filter((e) => e.date <= today);
  const pots: Record<SavingsPot, number> = { ...untrackedMoney(upToToday, today).savings };
  for (const s of accountSummaries(data.accounts, upToToday, today)) {
    if (s.account.savingsPot && accountGroupOf(s.account.type) === 'cash') {
      pots[s.account.savingsPot] += s.value;
    }
  }

  // Full months before this one; the current month is still in progress.
  const previous = monthsEnding(today, AVERAGE_MONTHS + 1).slice(0, AVERAGE_MONTHS);
  const monthly = monthlyTotals(upToToday, previous);
  const firstEntry = upToToday.reduce<string | undefined>(
    (min, e) => (min === undefined || e.date < min ? e.date : min),
    undefined,
  );
  const tracked = monthly.filter((m) => firstEntry !== undefined && m.month >= monthOf(firstEntry));
  const monthlyAverage =
    tracked.length === 0
      ? null
      : toWholeRupees(tracked.reduce((sum, m) => sum + m.totals.saved, 0) / tracked.length);
  const withExpenses = monthly.filter((m) => m.totals.expenses > 0);
  const current = totalsOf(inRange(upToToday, monthRange(monthOf(today))));
  const monthlyExpenses =
    withExpenses.length > 0
      ? toWholeRupees(
          withExpenses.reduce((sum, m) => sum + m.totals.expenses, 0) / withExpenses.length,
        )
      : current.expenses > 0
        ? current.expenses
        : null;

  return {
    total: SAVINGS_POTS.reduce((sum, p) => sum + pots[p], 0),
    general: pots.general,
    emergency: pots.emergency,
    thisMonth: current.saved,
    monthlyAverage,
    monthlyExpenses,
    emergencyMonths: monthlyExpenses === null ? null : pots.emergency / monthlyExpenses,
    emergencyTarget: monthlyExpenses === null ? null : monthlyExpenses * targetMonths,
    targetMonths,
  };
}

/* ---------- Budgets ---------- */

/** Share of a budget at which it's flagged as nearly used. */
export const BUDGET_NEAR = 0.8;

export type BudgetState = 'ok' | 'near' | 'over';

export interface BudgetStatus {
  budget: Budget;
  range: DateRange;
  spent: number;
  /** limit − spent; negative when over. */
  remaining: number;
  utilization: number;
  state: BudgetState;
}

export function budgetState(utilization: number): BudgetState {
  if (utilization > 1) return 'over';
  if (utilization >= BUDGET_NEAR) return 'near';
  return 'ok';
}

/** True when an expense falls under a budget's category (all, a group, or one category). */
export function budgetCovers(
  budgetCategory: string,
  expenseCategory: string,
  categories: readonly FinanceCategory[],
): boolean {
  if (budgetCategory === 'all') return true;
  if (budgetCategory.startsWith(GROUP_PREFIX)) {
    return (
      expenseGroupOf(expenseCategory, categories) === budgetCategory.slice(GROUP_PREFIX.length)
    );
  }
  return budgetCategory === expenseCategory;
}

/** Each budget measured against the current month (monthly) or year (annual). */
export function budgetStatuses(
  budgets: readonly Budget[],
  entries: readonly FinanceEntry[],
  today: string,
  categories: readonly FinanceCategory[] = [],
): BudgetStatus[] {
  const expenses = entries.filter((e) => e.kind === 'expense' && e.date <= today);
  return budgets.map((budget) => {
    const range =
      budget.period === 'monthly' ? monthRange(monthOf(today)) : yearRange(yearOf(today));
    const spent = inRange(expenses, range)
      .filter((e) => budgetCovers(budget.category, e.category, categories))
      .reduce((sum, e) => sum + e.amount, 0);
    const utilization = spent / budget.limit;
    return {
      budget,
      range,
      spent,
      remaining: budget.limit - spent,
      utilization,
      state: budgetState(utilization),
    };
  });
}

/* ---------- Yearly goals ---------- */

export type GoalState = 'done' | 'on_track' | 'behind' | 'within' | 'over';

export interface GoalProgress {
  goal: FinanceGoal;
  /** Saved, invested, or spent so far in the goal's year. */
  current: number;
  /** Still to save or invest, or spending allowance left. Never negative. */
  remaining: number;
  /** current ÷ target (may exceed 1). */
  fraction: number;
  /** Share of the goal's time window elapsed by today, 0–1. */
  elapsed: number;
  state: GoalState;
  /** Whole calendar months left until the deadline, counting this one. */
  monthsLeft: number;
  /** Per month needed (savings, investment) or allowed (spending) from now on, whole rupees. */
  perMonth: number | null;
}

function monthsInclusive(from: string, to: string): number {
  if (to < from) return 0;
  const [fy, fm] = from.split('-').map(Number) as [number, number];
  const [ty, tm] = to.split('-').map(Number) as [number, number];
  return (ty - fy) * 12 + (tm - fm) + 1;
}

export function goalProgress(
  goal: FinanceGoal,
  entries: readonly FinanceEntry[],
  today: string,
): GoalProgress {
  const start = `${goal.year}-01-01`;
  const range = { from: start, to: goal.deadline };
  const within = inRange(entries, range).filter((e) => e.date <= today);
  const totals = totalsOf(within);
  const current =
    goal.kind === 'savings'
      ? totals.saved
      : goal.kind === 'investment'
        ? totals.invested
        : totals.expenses;

  const span = daysBetween(start, goal.deadline) + 1;
  const passed = Math.min(Math.max(daysBetween(start, today) + 1, 0), span);
  const elapsed = span <= 0 ? 1 : passed / span;
  const monthsLeft =
    today > goal.deadline ? 0 : monthsInclusive(today < start ? start : today, goal.deadline);
  const fraction = current / goal.target;
  const remaining = Math.max(goal.target - current, 0);
  // Rounded up when it's an amount to put away, down when it's an allowance.
  const perMonth =
    monthsLeft === 0
      ? null
      : goal.kind === 'spending'
        ? toWholeRupees(remaining / monthsLeft, Math.floor)
        : toWholeRupees(remaining / monthsLeft, Math.ceil);

  let state: GoalState;
  if (goal.kind === 'spending') {
    // Spending more than the time elapsed would allow is flagged before it goes over.
    state =
      current > goal.target ? 'over' : fraction > elapsed && elapsed < 1 ? 'behind' : 'within';
  } else if (current >= goal.target) {
    state = 'done';
  } else {
    state = fraction >= elapsed ? 'on_track' : 'behind';
  }
  return { goal, current, remaining, fraction, elapsed, state, monthsLeft, perMonth };
}

/* ---------- Salary ---------- */

/** The salary in effect on `today`: the latest revision that has started. */
export function currentSalary(
  salaries: readonly SalaryRecord[],
  today: string,
): SalaryRecord | undefined {
  return salaries
    .filter((s) => s.effectiveFrom <= today)
    .reduce<SalaryRecord | undefined>(
      (latest, s) => (latest === undefined || s.effectiveFrom > latest.effectiveFrom ? s : latest),
      undefined,
    );
}

export interface SalaryRevision {
  salary: SalaryRecord;
  /** Change in monthly in-hand pay from the revision before, as a share, or null for the first. */
  change: number | null;
}

/** Salary revisions, newest first, each with its change from the one before. */
export function salaryHistory(salaries: readonly SalaryRecord[]): SalaryRevision[] {
  const ordered = [...salaries].sort((a, b) => a.effectiveFrom.localeCompare(b.effectiveFrom));
  return ordered
    .map((salary, i) => {
      const before = ordered[i - 1];
      return {
        salary,
        change:
          before === undefined
            ? null
            : ratio(salary.monthlyInHand - before.monthlyInHand, before.monthlyInHand),
      };
    })
    .reverse();
}

/* ---------- Recurring payments ---------- */

/**
 * The payment date after `date`. Monthly, quarterly, and yearly dates keep the start date's
 * day of the month, falling back to the month's last day (31st → 30th, 28th/29th).
 */
export function nextOccurrence(
  date: string,
  frequency: RecurringFrequency,
  anchor: string,
): string {
  if (frequency === 'weekly') return addDays(date, 7);
  const months = frequency === 'monthly' ? 1 : frequency === 'quarterly' ? 3 : 12;
  const first = addMonths(`${date.slice(0, 7)}-01`, months);
  const last = endOfMonth(first);
  const wanted = `${first.slice(0, 8)}${anchor.slice(8)}`;
  return wanted > last ? last : wanted;
}

/** Active rules with a payment due on or before `today`, earliest first. */
export function dueRecurring(rules: readonly RecurringRule[], today: string): RecurringRule[] {
  return rules
    .filter((r) => r.endedAt === undefined && r.nextDue <= today)
    .sort((a, b) => a.nextDue.localeCompare(b.nextDue));
}

/** Active rules with the next payment in the coming `days` days (after today). */
export function upcomingRecurring(
  rules: readonly RecurringRule[],
  today: string,
  days = 7,
): RecurringRule[] {
  const until = addDays(today, days);
  return rules
    .filter((r) => r.endedAt === undefined && r.nextDue > today && r.nextDue <= until)
    .sort((a, b) => a.nextDue.localeCompare(b.nextDue));
}

/** A rule's expected amount per month, for planning (weekly ≈ 52 ÷ 12 payments a month). */
export function monthlyEquivalent(rule: Pick<RecurringRule, 'amount' | 'frequency'>): number {
  const perYear = { weekly: 52, monthly: 12, quarterly: 4, yearly: 1 }[rule.frequency];
  return toWholeRupees((rule.amount * perYear) / 12);
}

/* ---------- Search and filters ---------- */

export interface EntryFilter {
  text?: string | undefined;
  kind?: EntryKind | undefined;
  /** An expense subcategory, `group:<group>`, or any other kind's category. */
  category?: string | undefined;
  /** `YYYY-MM`. */
  month?: string | undefined;
  /** Entries that moved money in or out of this account. */
  accountId?: string | undefined;
}

const fold = (value: string) =>
  value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();

/**
 * Entries matching every given filter, newest first. Text matches the note, the category and
 * its group, the account names, or the amount in rupees; every word must match somewhere.
 */
export function filterEntries(
  entries: readonly FinanceEntry[],
  filter: EntryFilter,
  data: Pick<FinanceData, 'categories' | 'accounts'>,
): FinanceEntry[] {
  const words = fold(filter.text ?? '')
    .split(/\s+/)
    .filter(Boolean);
  const accountNames = new Map(data.accounts.map((a) => [a.id, a.name]));
  return entries
    .filter((e) => {
      if (filter.kind && e.kind !== filter.kind) return false;
      if (filter.category) {
        const matches =
          e.kind === 'expense'
            ? budgetCovers(filter.category, e.category, data.categories)
            : e.category === filter.category;
        if (!matches) return false;
      }
      if (filter.month && monthOf(e.date) !== filter.month) return false;
      if (
        filter.accountId &&
        e.accountId !== filter.accountId &&
        e.toAccountId !== filter.accountId
      ) {
        return false;
      }
      if (words.length === 0) return true;
      const group =
        e.kind === 'expense'
          ? expenseGroupLabel(expenseGroupOf(e.category, data.categories), data.categories)
          : '';
      const haystack = fold(
        [
          e.note ?? '',
          categoryLabel(e.kind, e.category, data.categories),
          group,
          e.accountId ? (accountNames.get(e.accountId) ?? '') : '',
          e.toAccountId ? (accountNames.get(e.toAccountId) ?? '') : '',
          String(e.amount / PAISE_PER_RUPEE),
        ].join(' '),
      );
      return words.every((w) => haystack.includes(w));
    })
    .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
}
