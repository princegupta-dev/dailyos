import { describe, expect, it } from 'vitest';
import type {
  Account,
  AccountType,
  Budget,
  FinanceCategory,
  FinanceEntry,
  FinanceGoal,
  RecurringRule,
  SalaryRecord,
} from '@/domain/finance';
import { categoryPath, expenseGroupOf } from '@/domain/finance';
import { formatINR, parseRupees } from '@/lib/money';
import {
  accountSummaries,
  balanceSheet,
  breakdownBy,
  budgetStatuses,
  currentSalary,
  dueRecurring,
  filterEntries,
  goalProgress,
  monthlyEquivalent,
  monthsEnding,
  nextOccurrence,
  portfolioSummary,
  salaryHistory,
  savingsSummary,
  spendingByGroup,
  spendingChanges,
  totalsOf,
  upcomingRecurring,
  wealthTrend,
  type FinanceData,
} from '@/services/finance.service';

const NOW = '2026-10-09T09:00:00.000Z';
const stamp = { createdAt: NOW, updatedAt: NOW };
let seq = 0;
const id = () => `00000000-0000-4000-8000-${String(++seq).padStart(12, '0')}`;
const r = (rupees: number) => rupees * 100;

function entry(
  kind: FinanceEntry['kind'],
  rupees: number,
  date: string,
  category: string,
  extra: Partial<FinanceEntry> = {},
): FinanceEntry {
  return { id: id(), kind, amount: r(rupees), date, category, ...stamp, ...extra };
}

function account(type: AccountType, rupees: number, extra: Partial<Account> = {}): Account {
  return {
    id: id(),
    name: type,
    type,
    balance: r(rupees),
    asOf: '2026-09-30',
    balanceSetAt: NOW,
    ...stamp,
    ...extra,
  };
}

function data(partial: Partial<FinanceData>): FinanceData {
  return {
    entries: [],
    accounts: [],
    goals: [],
    budgets: [],
    salaries: [],
    categories: [],
    recurring: [],
    ...partial,
  };
}

describe('money helpers', () => {
  it('parses typed rupees into whole paise', () => {
    expect(parseRupees('1,23,456.5')).toBe(12_345_650);
    expect(parseRupees('₹ 2000')).toBe(200_000);
    expect(parseRupees('0.05')).toBe(5);
    expect(parseRupees('12.345')).toBeUndefined();
    expect(parseRupees('-5')).toBeUndefined();
    expect(parseRupees('abc')).toBeUndefined();
  });

  it('formats paise in INR with Indian grouping', () => {
    expect(formatINR(r(1_234_567))).toBe('₹12,34,567');
    expect(formatINR(12_345)).toBe('₹123.45');
    expect(formatINR(-r(500))).toBe('−₹500');
    expect(formatINR(r(250), { signed: true })).toBe('+₹250');
    expect(formatINR(r(120_000), { compact: true })).toBe('₹1.2L');
  });
});

describe('flow totals', () => {
  it('keeps every kind separate and leaves transfers out', () => {
    const totals = totalsOf([
      entry('income', 100_000, '2026-10-01', 'salary'),
      entry('expense', 40_000, '2026-10-02', 'rent'),
      entry('investment', 20_000, '2026-10-03', 'mutual_fund'),
      entry('saving', 10_000, '2026-10-04', 'emergency'),
      entry('transfer', 50_000, '2026-10-05', 'transfer'),
    ]);
    expect(totals).toEqual({
      income: r(100_000),
      expenses: r(40_000),
      invested: r(20_000),
      saved: r(10_000),
      repaid: 0,
      transferred: r(50_000),
      surplus: r(60_000),
      unallocated: r(30_000),
      savingsRate: 0.6,
    });
  });

  it('counts loan and card principal as debt repaid, never as spending', () => {
    const bank = account('bank_savings', 0);
    const loan = account('loan', 50_000);
    const card = account('credit_card', 0);
    const liabilities = new Set([loan.id, card.id]);
    const totals = totalsOf(
      [
        entry('income', 80_000, '2026-10-01', 'salary', { toAccountId: bank.id }),
        // EMI: principal is a transfer to the loan, interest is an expense.
        entry('transfer', 5_000, '2026-10-10', 'transfer', {
          accountId: bank.id,
          toAccountId: loan.id,
        }),
        entry('expense', 600, '2026-10-10', 'loan_interest', { accountId: bank.id }),
        // A card purchase is spending once; paying the bill is not spending again.
        entry('expense', 2_000, '2026-10-05', 'groceries', { accountId: card.id }),
        entry('transfer', 2_000, '2026-10-15', 'transfer', {
          accountId: bank.id,
          toAccountId: card.id,
        }),
      ],
      liabilities,
    );
    expect(totals).toMatchObject({
      income: r(80_000),
      expenses: r(2_600),
      repaid: r(7_000),
      transferred: 0,
      unallocated: r(70_400),
    });
  });

  it('subtracts withdrawals from savings and investments', () => {
    const totals = totalsOf([
      entry('income', 10_000, '2026-10-01', 'salary'),
      entry('saving', 5_000, '2026-10-02', 'general'),
      entry('saving', 2_000, '2026-10-03', 'general', { withdrawal: true }),
      entry('investment', 3_000, '2026-10-04', 'stock'),
      entry('investment', 1_000, '2026-10-05', 'stock', { withdrawal: true }),
    ]);
    expect(totals.saved).toBe(r(3_000));
    expect(totals.invested).toBe(r(2_000));
    expect(totals.unallocated).toBe(r(5_000));
  });

  it('has no savings rate without income', () => {
    expect(totalsOf([entry('expense', 10, '2026-10-01', 'cafe')]).savingsRate).toBeNull();
  });
});

describe('account balances', () => {
  it('moves each account from its checkpoint by the money in and out after it', () => {
    const bank = account('bank_savings', 10_000);
    const cash = account('cash', 500);
    const entries = [
      // Before the checkpoint: already in the balance.
      entry('income', 99_999, '2026-09-30', 'salary', { toAccountId: bank.id }),
      entry('income', 50_000, '2026-10-01', 'salary', { toAccountId: bank.id }),
      entry('expense', 2_000, '2026-10-02', 'rent', { accountId: bank.id }),
      entry('transfer', 1_000, '2026-10-03', 'transfer', {
        accountId: bank.id,
        toAccountId: cash.id,
      }),
      entry('expense', 300, '2026-10-04', 'snacks', { accountId: cash.id }),
    ];
    const [b, c] = accountSummaries([bank, cash], entries, '2026-10-09');
    expect(b?.value).toBe(r(57_000));
    expect(c?.value).toBe(r(1_200));
  });

  it('counts an entry on the checkpoint day only if recorded after the balance', () => {
    const bank = account('bank_savings', 1_000, { asOf: '2026-10-09' });
    const before = entry('expense', 100, '2026-10-09', 'cafe', {
      accountId: bank.id,
      createdAt: '2026-10-09T08:00:00.000Z',
    });
    const after = entry('expense', 200, '2026-10-09', 'cafe', {
      accountId: bank.id,
      createdAt: '2026-10-09T10:00:00.000Z',
    });
    expect(accountSummaries([bank], [before, after], '2026-10-09')[0]?.value).toBe(r(800));
  });

  it('keeps investment gains apart from money added', () => {
    const fund = account('mutual_fund', 12_000, {
      invested: r(10_000),
      valuedOn: '2026-09-30',
    });
    const [s] = accountSummaries(
      [fund],
      [entry('investment', 1_000, '2026-10-05', 'mutual_fund', { toAccountId: fund.id })],
      '2026-10-09',
    );
    expect(s).toMatchObject({
      value: r(13_000),
      invested: r(11_000),
      gain: r(2_000),
      valued: true,
    });
    expect(s?.gainRate).toBeCloseTo(2 / 11);
  });

  it('tracks loans and cards as amounts owed that repayments lower', () => {
    const bank = account('bank_savings', 20_000);
    const card = account('credit_card', 1_000);
    const entries = [
      entry('expense', 3_000, '2026-10-02', 'clothing', { accountId: card.id }),
      entry('transfer', 2_500, '2026-10-05', 'transfer', {
        accountId: bank.id,
        toAccountId: card.id,
      }),
    ];
    const [, c] = accountSummaries([bank, card], entries, '2026-10-09');
    expect(c).toMatchObject({ value: r(1_500), signedValue: -r(1_500) });
  });
});

describe('net worth', () => {
  it('adds accounts and money recorded without accounts, minus what is owed', () => {
    const bank = account('bank_savings', 10_000);
    const emergency = account('bank_savings', 5_000, { savingsPot: 'emergency' });
    const fund = account('sip', 0, { invested: 0 });
    const loan = account('loan', 40_000);
    const entries = [
      entry('income', 50_000, '2026-10-01', 'salary', { toAccountId: bank.id }),
      entry('investment', 10_000, '2026-10-02', 'sip', {
        accountId: bank.id,
        toAccountId: fund.id,
      }),
      entry('saving', 4_000, '2026-10-03', 'emergency', {
        accountId: bank.id,
        toAccountId: emergency.id,
      }),
      entry('transfer', 6_000, '2026-10-04', 'transfer', {
        accountId: bank.id,
        toAccountId: loan.id,
      }),
      // No account at all: still counted, as untracked cash and savings.
      entry('income', 1_000, '2026-10-05', 'gift'),
      entry('saving', 300, '2026-10-06', 'general'),
      entry('investment', 2_000, '2026-10-07', 'gold_digital', { accountId: bank.id }),
    ];
    const sheet = balanceSheet(
      data({ entries, accounts: [bank, emergency, fund, loan] }),
      '2026-10-09',
    );
    // Bank: 10,000 + 50,000 − 10,000 − 4,000 − 6,000 − 2,000 = 38,000; untracked cash 700.
    expect(sheet).toEqual({
      available: r(38_700),
      savings: r(9_300),
      investments: r(12_000),
      liabilities: r(34_000),
      netWorth: r(26_000),
    });
  });

  it('ignores entries dated after today', () => {
    const sheet = balanceSheet(
      data({ entries: [entry('income', 100, '2026-10-10', 'salary')] }),
      '2026-10-09',
    );
    expect(sheet.netWorth).toBe(0);
  });

  it('summarises the portfolio by type, including investments without an account', () => {
    const fund = account('mutual_fund', 12_000, { invested: r(10_000), valuedOn: '2026-09-30' });
    const fd = account('fixed_deposit', 5_000, { invested: r(5_000) });
    const p = portfolioSummary(
      data({
        accounts: [fund, fd],
        entries: [entry('investment', 1_000, '2026-10-04', 'gold_digital')],
      }),
      '2026-10-09',
    );
    expect(p).toMatchObject({
      invested: r(16_000),
      value: r(18_000),
      gain: r(2_000),
      unassigned: r(1_000),
    });
    expect(p.allocation.map((s) => [s.type, s.value])).toEqual([
      ['mutual_fund', r(12_000)],
      ['fixed_deposit', r(5_000)],
      ['gold_digital', r(1_000)],
    ]);
  });
});

describe('categories', () => {
  const pets: FinanceCategory = {
    id: id(),
    kind: 'expense',
    name: 'Pets',
    createdAt: NOW,
  };
  const vet: FinanceCategory = {
    id: id(),
    kind: 'expense',
    name: 'Vet',
    parent: pets.id,
    createdAt: NOW,
  };
  const tuition: FinanceCategory = {
    id: id(),
    kind: 'expense',
    name: 'Tuition',
    parent: 'family',
    createdAt: NOW,
  };
  const custom = [pets, vet, tuition];

  it('places built-in and custom categories in their groups', () => {
    expect(expenseGroupOf('groceries', custom)).toBe('food');
    expect(expenseGroupOf(vet.id, custom)).toBe(pets.id);
    expect(expenseGroupOf(pets.id, custom)).toBe(pets.id);
    expect(expenseGroupOf(tuition.id, custom)).toBe('family');
    expect(categoryPath('expense', 'parents_support', custom)).toBe(
      'Family › Parents’ living expenses',
    );
    expect(categoryPath('expense', vet.id, custom)).toBe('Pets › Vet');
  });

  it('breaks spending down by group with subcategories', () => {
    const groups = spendingByGroup(
      [
        entry('expense', 300, '2026-10-01', 'cafe'),
        entry('expense', 500, '2026-10-01', 'groceries'),
        entry('expense', 1_200, '2026-10-02', vet.id),
        entry('investment', 9_999, '2026-10-02', 'sip'),
      ],
      custom,
    );
    expect(groups.map((g) => [g.category, g.amount, g.share])).toEqual([
      [`group:${pets.id}`, r(1_200), 0.6],
      ['group:food', r(800), 0.4],
    ]);
    expect(groups[1]?.items.map((i) => i.label)).toEqual(['Groceries', 'Cafes']);
  });

  it('reports which groups moved between periods', () => {
    const changes = spendingChanges(
      [entry('expense', 3_000, '2026-10-02', 'dining_out')],
      [
        entry('expense', 1_000, '2026-09-02', 'dining_out'),
        entry('expense', 500, '2026-09-03', 'movies'),
      ],
      [],
    );
    expect(changes.map((c) => [c.label, c.change])).toEqual([
      ['Food', r(2_000)],
      ['Lifestyle & entertainment', -r(500)],
    ]);
  });

  it('keeps income sources as their own breakdown', () => {
    const rows = breakdownBy(
      [
        entry('income', 700, '2026-10-02', 'freelance'),
        entry('income', 300, '2026-10-02', 'interest'),
      ],
      'income',
      [],
    );
    expect(rows.map((x) => [x.label, x.share])).toEqual([
      ['Freelance', 0.7],
      ['Interest', 0.3],
    ]);
  });
});

describe('savings', () => {
  it('reports pots from savings accounts and unlinked savings, and emergency coverage', () => {
    const emergency = account('bank_savings', 40_000, { savingsPot: 'emergency' });
    const entries = [
      entry('expense', 30_000, '2026-07-10', 'rent'),
      entry('expense', 20_000, '2026-08-10', 'rent'),
      entry('expense', 10_000, '2026-09-10', 'rent'),
      entry('saving', 20_000, '2026-10-01', 'emergency', { toAccountId: emergency.id }),
      entry('saving', 5_000, '2026-10-02', 'general'),
    ];
    const s = savingsSummary(data({ entries, accounts: [emergency] }), '2026-10-09', 4);
    expect(s).toMatchObject({
      total: r(65_000),
      general: r(5_000),
      emergency: r(60_000),
      thisMonth: r(25_000),
      monthlyExpenses: r(20_000),
      emergencyMonths: 3,
      emergencyTarget: r(80_000),
      targetMonths: 4,
    });
  });
});

describe('budgets', () => {
  const budget = (
    category: string,
    limit: number,
    period: Budget['period'] = 'monthly',
  ): Budget => ({
    id: id(),
    period,
    category,
    limit: r(limit),
    ...stamp,
  });

  it('measures budgets for one category, a whole group, or everything', () => {
    const entries = [
      entry('expense', 900, '2026-10-02', 'groceries'),
      entry('expense', 300, '2026-10-03', 'cafe'),
      entry('expense', 500, '2026-09-30', 'groceries'),
      entry('expense', 2_000, '2026-10-03', 'rent'),
    ];
    const [groceries, food, all, annual] = budgetStatuses(
      [
        budget('groceries', 1_000),
        budget('group:food', 1_100),
        budget('all', 3_000),
        budget('all', 10_000, 'annual'),
      ],
      entries,
      '2026-10-09',
    );
    expect(groceries).toMatchObject({ spent: r(900), remaining: r(100), state: 'near' });
    expect(food).toMatchObject({ spent: r(1_200), remaining: -r(100), state: 'over' });
    expect(all).toMatchObject({ spent: r(3_200), state: 'over' });
    expect(annual).toMatchObject({ spent: r(3_700), state: 'ok', utilization: 0.37 });
  });
});

describe('yearly goals', () => {
  const goal = (kind: FinanceGoal['kind'], target: number): FinanceGoal => ({
    id: id(),
    name: 'Goal',
    kind,
    year: 2026,
    target: r(target),
    deadline: '2026-12-31',
    ...stamp,
  });

  it('tracks savings against the share of the year passed, and the amount needed monthly', () => {
    const entries = [
      entry('saving', 90_000, '2026-05-01', 'general'),
      entry('saving', 10_000, '2025-12-31', 'general'),
    ];
    const p = goalProgress(goal('savings', 120_000), entries, '2026-10-09');
    expect(p).toMatchObject({
      current: r(90_000),
      remaining: r(30_000),
      monthsLeft: 3,
      perMonth: r(10_000),
      state: 'behind',
    });
    expect(goalProgress(goal('savings', 100_000), entries, '2026-10-09').state).toBe('on_track');
    expect(goalProgress(goal('savings', 80_000), entries, '2026-10-09').state).toBe('done');
  });

  it('rounds the monthly amount to whole rupees', () => {
    const p = goalProgress(goal('savings', 100_000), [], '2026-10-09');
    expect(p.perMonth).toBe(r(33_334));
    expect(goalProgress(goal('spending', 100_000), [], '2026-10-09').perMonth).toBe(r(33_333));
  });

  it('treats a spending goal as a ceiling', () => {
    const entries = [entry('expense', 50_000, '2026-03-01', 'rent')];
    expect(goalProgress(goal('spending', 100_000), entries, '2026-10-09').state).toBe('within');
    expect(goalProgress(goal('spending', 55_000), entries, '2026-03-02').state).toBe('behind');
    expect(goalProgress(goal('spending', 40_000), entries, '2026-10-09')).toMatchObject({
      state: 'over',
      remaining: 0,
    });
  });
});

describe('recurring payments', () => {
  const rule = (frequency: RecurringRule['frequency'], startDate: string, nextDue: string) =>
    ({
      id: id(),
      kind: 'expense',
      amount: r(1_200),
      category: 'rent',
      frequency,
      startDate,
      nextDue,
      ...stamp,
    }) satisfies RecurringRule;

  it('keeps the start day of the month, falling back to the month’s last day', () => {
    expect(nextOccurrence('2026-01-31', 'monthly', '2026-01-31')).toBe('2026-02-28');
    expect(nextOccurrence('2026-02-28', 'monthly', '2026-01-31')).toBe('2026-03-31');
    expect(nextOccurrence('2026-11-15', 'quarterly', '2026-02-15')).toBe('2027-02-15');
    expect(nextOccurrence('2028-02-29', 'yearly', '2028-02-29')).toBe('2029-02-28');
    expect(nextOccurrence('2026-10-09', 'weekly', '2026-10-02')).toBe('2026-10-16');
  });

  it('lists due and upcoming payments, and their monthly equivalent', () => {
    const due = rule('monthly', '2026-09-05', '2026-10-05');
    const soon = rule('monthly', '2026-09-12', '2026-10-12');
    const later = rule('monthly', '2026-09-30', '2026-10-30');
    const ended = { ...rule('monthly', '2026-01-01', '2026-02-01'), endedAt: NOW };
    expect(dueRecurring([soon, due, ended], '2026-10-09')).toEqual([due]);
    expect(upcomingRecurring([due, soon, later], '2026-10-09')).toEqual([soon]);
    expect(monthlyEquivalent({ amount: r(1_200), frequency: 'quarterly' })).toBe(r(400));
    expect(monthlyEquivalent({ amount: r(1_000), frequency: 'weekly' })).toBe(r(4_333));
  });
});

describe('periods and trends', () => {
  it('lists months ending with the given date across a year boundary', () => {
    expect(monthsEnding('2026-02-14', 4)).toEqual(['2025-11', '2025-12', '2026-01', '2026-02']);
  });

  it('accumulates wealth from earlier history', () => {
    const entries = [
      entry('saving', 1_000, '2026-01-15', 'general'),
      entry('investment', 2_000, '2026-03-01', 'stock'),
      entry('saving', 500, '2026-04-01', 'general', { withdrawal: true }),
    ];
    expect(wealthTrend(entries, ['2026-03', '2026-04'])).toEqual([
      { month: '2026-03', added: r(2_000), total: r(3_000) },
      { month: '2026-04', added: -r(500), total: r(2_500) },
    ]);
  });
});

describe('salary', () => {
  const salary = (from: string, inHand: number): SalaryRecord => ({
    id: id(),
    effectiveFrom: from,
    monthlyGross: r(inHand * 1.25),
    monthlyInHand: r(inHand),
    ...stamp,
  });

  it('picks the latest revision that has started and computes raises', () => {
    const records = [
      salary('2025-04-01', 80_000),
      salary('2026-04-01', 90_000),
      salary('2027-01-01', 99_000),
    ];
    expect(currentSalary(records, '2026-10-09')?.monthlyInHand).toBe(r(90_000));
    const history = salaryHistory(records);
    expect(history.map((h) => h.salary.effectiveFrom)).toEqual([
      '2027-01-01',
      '2026-04-01',
      '2025-04-01',
    ]);
    expect(history[1]?.change).toBe(0.125);
    expect(history[2]?.change).toBeNull();
  });
});

describe('search and filters', () => {
  it('matches words across note, category, group, account, and amount', () => {
    const bank = account('bank_savings', 0, { name: 'Salary account' });
    const entries = [
      entry('expense', 450, '2026-10-01', 'cafe', { note: 'Café latte' }),
      entry('expense', 1_200, '2026-09-20', 'groceries', { accountId: bank.id }),
      entry('income', 5_000, '2026-10-02', 'salary', { toAccountId: bank.id }),
    ];
    const ctx = { categories: [], accounts: [bank] };
    expect(filterEntries(entries, { text: 'cafe' }, ctx)).toHaveLength(1);
    expect(filterEntries(entries, { text: 'food 1200' }, ctx)).toHaveLength(1);
    expect(filterEntries(entries, { accountId: bank.id }, ctx)).toHaveLength(2);
    expect(filterEntries(entries, { kind: 'expense', category: 'group:food' }, ctx)).toHaveLength(
      2,
    );
    expect(filterEntries(entries, {}, ctx).map((e) => e.date)).toEqual([
      '2026-10-02',
      '2026-10-01',
      '2026-09-20',
    ]);
  });
});
