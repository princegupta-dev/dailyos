import { ArrowDownLeft, ArrowUpRight, HandCoins, Percent, PiggyBank, Wallet } from 'lucide-react';
import { Link } from 'react-router';
import { LiveView } from '@/components/LiveView';
import { Section } from '@/components/Section';
import { getFinanceData } from '@/db/repositories/finance';
import { categoryLabel } from '@/domain/finance';
import type { Period } from '@/domain/review';
import { useLiveData } from '@/hooks/useLiveData';
import { formatINR } from '@/lib/money';
import {
  budgetStatuses,
  goalProgress,
  inRange,
  isFinanceEmpty,
  liabilityIds,
  spendingByGroup,
  totalsOf,
  yearOf,
  type FinanceData,
} from '@/services/finance.service';
import { BreakdownBars } from '../investments/FinanceCharts';
import { BudgetItem, GoalItem, MoneyKpi } from '../investments/FinanceCards';
import { percent } from './format';

/**
 * The money side of a review: what came in, went out, and was put away in the period, where
 * spending went, and (for a month) budgets and yearly goals. Hidden until money is tracked.
 */
export function MoneyReport({ period, today }: { period: Period; today: string }) {
  const finance = useLiveData(getFinanceData);
  return (
    <LiveView state={finance} skeleton={null}>
      {(data) =>
        isFinanceEmpty(data) ? null : <MoneyReportBody data={data} period={period} today={today} />
      }
    </LiveView>
  );
}

function MoneyReportBody({
  data,
  period,
  today,
}: {
  data: FinanceData;
  period: Period;
  today: string;
}) {
  const end = period.end < today ? period.end : today;
  const entries = inRange(
    data.entries.filter((e) => e.date <= today),
    { from: period.start, to: period.end },
  );
  const totals = totalsOf(entries, liabilityIds(data.accounts));
  const groups = spendingByGroup(entries, data.categories);
  const monthly = period.type === 'monthly';
  // A month's budgets and goals, measured as of the month's last day (or today).
  const budgets = monthly
    ? budgetStatuses(
        data.budgets.filter((b) => b.period === 'monthly'),
        data.entries,
        end,
        data.categories,
      )
    : [];
  const goals = monthly
    ? data.goals
        .filter((g) => g.year === yearOf(end))
        .map((g) => goalProgress(g, data.entries, end))
    : [];

  return (
    <Section
      title="Money"
      icon={Wallet}
      description="Expense Tracker report for this period"
      className="money-report"
      meta={
        <Link
          to={
            monthly
              ? `/investments/analysis?at=${period.start.slice(0, 7)}`
              : '/investments/activity'
          }
        >
          {monthly ? 'Full analysis' : 'Transactions'}
        </Link>
      }
    >
      <dl className="kpis kpis--three">
        <MoneyKpi
          icon={ArrowDownLeft}
          label="Income"
          value={formatINR(totals.income, { compact: true })}
        />
        <MoneyKpi
          icon={ArrowUpRight}
          label="Spent"
          value={formatINR(totals.expenses, { compact: true })}
        />
        <MoneyKpi
          icon={PiggyBank}
          label="Saved & invested"
          value={formatINR(totals.saved + totals.invested, { compact: true })}
        />
        {totals.repaid > 0 && (
          <MoneyKpi
            icon={HandCoins}
            label="Debt repaid"
            value={formatINR(totals.repaid, { compact: true })}
          />
        )}
        {period.type !== 'daily' && (
          <MoneyKpi
            icon={Percent}
            label="Savings rate"
            value={percent(totals.savingsRate)}
            alert={totals.savingsRate !== null && totals.savingsRate < 0}
          />
        )}
      </dl>
      {groups.length > 0 && (
        <div className="money-report__block">
          <p className="money-report__subtitle">Where it went</p>
          <BreakdownBars items={groups} limit={4} empty="" />
        </div>
      )}
      {budgets.length > 0 && (
        <div className="money-report__block budget-list">
          <p className="money-report__subtitle">Budgets</p>
          {budgets.map((b) => (
            <BudgetItem
              key={b.budget.id}
              status={b}
              label={categoryLabel('expense', b.budget.category, data.categories)}
            />
          ))}
        </div>
      )}
      {goals.length > 0 && (
        <div className="money-report__block goal-list">
          <p className="money-report__subtitle">{yearOf(end)} goals</p>
          {goals.map((g) => (
            <GoalItem key={g.goal.id} progress={g} />
          ))}
        </div>
      )}
      {entries.length === 0 && <p className="quiet-note">No money recorded in this period.</p>}
    </Section>
  );
}
