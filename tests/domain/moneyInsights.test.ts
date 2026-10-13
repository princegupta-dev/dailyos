import { describe, expect, it } from 'vitest';
import type { FinanceEntry } from '@/domain/finance';
import {
  habitsAndMoney,
  habitsAndMoneyStory,
  moneyPeriod,
  moneySuggestions,
} from '@/features/insights/moneyInsights';
import type { InsightPeriod } from '@/features/insights/insightsModel';
import type { RangeSummary } from '@/services/analytics.service';
import type { FinanceData } from '@/services/finance.service';

const NOW = '2026-10-09T09:00:00.000Z';
let seq = 0;
const id = () => `00000000-0000-4000-8000-${String(++seq).padStart(12, '0')}`;
const r = (rupees: number) => rupees * 100;

function entry(kind: FinanceEntry['kind'], rupees: number, date: string, category: string) {
  return {
    id: id(),
    kind,
    amount: r(rupees),
    date,
    category,
    createdAt: NOW,
    updatedAt: NOW,
  } satisfies FinanceEntry;
}

function data(entries: FinanceEntry[], extra: Partial<FinanceData> = {}): FinanceData {
  return {
    entries,
    accounts: [],
    goals: [],
    budgets: [],
    salaries: [],
    categories: [],
    recurring: [],
    ...extra,
  };
}

const period: InsightPeriod = {
  from: '2026-10-01',
  to: '2026-10-09',
  prevFrom: '2026-09-01',
  prevTo: '2026-09-09',
  name: 'this month',
  prevName: 'last month',
};

describe('money insights', () => {
  it('compares the period with the same stretch before it', () => {
    const d = data([
      entry('income', 50_000, '2026-10-01', 'salary'),
      entry('expense', 3_000, '2026-10-03', 'dining_out'),
      entry('expense', 1_000, '2026-09-03', 'dining_out'),
      entry('expense', 9_999, '2026-09-20', 'dining_out'),
    ]);
    const money = moneyPeriod(d, period);
    expect(money.current.expenses).toBe(r(3_000));
    expect(money.previous.expenses).toBe(r(1_000));
    expect(money.changes[0]).toMatchObject({ label: 'Food', change: r(2_000) });
  });

  it('suggests looking at a group that jumped, and celebrates a healthy savings rate', () => {
    const d = data([
      entry('income', 50_000, '2026-10-01', 'salary'),
      entry('expense', 3_000, '2026-10-03', 'dining_out'),
      entry('expense', 1_000, '2026-09-03', 'dining_out'),
    ]);
    const tips = moneySuggestions({
      data: d,
      money: moneyPeriod(d, period),
      period,
      today: '2026-10-09',
    });
    expect(tips.map((t) => t.id)).toEqual(['money-rising', 'money-saving', 'money-emergency']);
    expect(tips[0]?.title).toBe('Food spending is up 200%');
    expect(tips[0]?.action?.to).toContain('category=group%3Afood');
  });

  it('flags spending more than earned, and payments that are due', () => {
    const d = data(
      [
        entry('income', 1_000, '2026-10-01', 'salary'),
        entry('expense', 2_000, '2026-10-03', 'rent'),
      ],
      {
        recurring: [
          {
            id: id(),
            kind: 'expense',
            amount: r(100),
            category: 'ott',
            frequency: 'monthly',
            startDate: '2026-10-01',
            nextDue: '2026-10-01',
            createdAt: NOW,
            updatedAt: NOW,
          },
        ],
      },
    );
    const ids = moneySuggestions({
      data: d,
      money: moneyPeriod(d, period),
      period,
      today: '2026-10-09',
    }).map((t) => t.id);
    expect(ids).toContain('money-negative');
    expect(ids).toContain('money-due');
  });

  it('puts habit weeks beside spending and compares strong and weak weeks', () => {
    const week = (from: string, to: string, rate: number | null): RangeSummary =>
      ({ from, to, habits: { overall: { rate } } }) as unknown as RangeSummary;
    const weeks = [
      week('2026-09-07', '2026-09-13', 0.9),
      week('2026-09-14', '2026-09-20', 0.3),
      week('2026-09-21', '2026-09-27', 0.8),
      week('2026-09-28', '2026-10-04', 0.2),
    ];
    const d = data([
      entry('expense', 1_000, '2026-09-08', 'cafe'),
      entry('expense', 3_000, '2026-09-15', 'cafe'),
      entry('expense', 1_000, '2026-09-22', 'cafe'),
      entry('expense', 3_000, '2026-09-29', 'cafe'),
    ]);
    const comparison = habitsAndMoney(weeks, d);
    expect(comparison).toMatchObject({ strong: r(1_000), weak: r(3_000) });
    expect(habitsAndMoneyStory(comparison)).toBe(
      'In your steadier habit weeks you spent 67% less (₹1,000 vs ₹3,000 a week).',
    );
    expect(habitsAndMoney(weeks.slice(0, 3), d).strong).toBeNull();
  });
});
