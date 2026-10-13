import { CalendarDays, CalendarRange, ChartPie, CircleDashed } from 'lucide-react';
import { EmptyState } from '@/components/EmptyState';
import { Section } from '@/components/Section';
import { categoryLabel } from '@/domain/finance';
import { daysBetween } from '@/lib/dates';
import { formatINR } from '@/lib/money';
import {
  budgetCovers,
  budgetStatuses,
  spendingByGroup,
  inRange,
  monthOf,
  monthRange,
  yearOf,
  type BudgetStatus,
} from '@/services/finance.service';
import { plural } from '../reviews/format';
import { AddTile, BudgetItem } from './FinanceCards';
import { useFinance } from './financeContext';
import { monthName } from './financeUi';

/** Overall budget first, then categories by how much of their limit is used. */
function ordered(statuses: readonly BudgetStatus[]): BudgetStatus[] {
  return [...statuses].sort(
    (a, b) =>
      Number(b.budget.category === 'all') - Number(a.budget.category === 'all') ||
      b.utilization - a.utilization,
  );
}

/** Monthly and annual spending limits, how much of each is used, and what's left. */
export function BudgetsPage() {
  const { data, today, open } = useFinance();
  const statuses = budgetStatuses(data.budgets, data.entries, today, data.categories);
  const monthly = ordered(statuses.filter((s) => s.budget.period === 'monthly'));
  const annual = ordered(statuses.filter((s) => s.budget.period === 'annual'));
  const month = monthOf(today);
  const range = monthRange(month);
  const daysLeft = daysBetween(today, range.to) + 1;
  const overall = monthly.find((s) => s.budget.category === 'all');
  const label = (s: BudgetStatus) => categoryLabel('expense', s.budget.category, data.categories);

  // Groups spent in this month that no monthly budget touches (as a group or category).
  const unbudgeted = spendingByGroup(
    inRange(
      data.entries.filter((e) => e.date <= today),
      range,
    ),
    data.categories,
  ).filter(
    (g) =>
      !monthly.some(
        (s) =>
          s.budget.category !== 'all' &&
          (s.budget.category === g.category ||
            g.items.some((i) => budgetCovers(s.budget.category, i.category, data.categories))),
      ),
  );

  if (data.budgets.length === 0) {
    return (
      <div className="finance-stack">
        <EmptyState
          icon={ChartPie}
          title="No budgets yet"
          description="Set a limit for all spending or for one category. It repeats every month (or year), and you’ll see how much is left."
        />
        <div className="finance-actions">
          <button
            type="button"
            className="button button--primary"
            onClick={() => {
              open({ type: 'budget', period: 'monthly', category: 'all' });
            }}
          >
            Set a monthly budget
          </button>
          <button
            type="button"
            className="button button--secondary"
            onClick={() => {
              open({ type: 'budget', period: 'annual', category: 'all' });
            }}
          >
            Set an annual budget
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="finance-grid">
      <div className="finance-grid__main">
        <Section
          title={monthName(month)}
          icon={CalendarDays}
          description={`${plural(daysLeft, 'day')} left this month`}
          className="finance-card"
        >
          {overall && overall.remaining > 0 && (
            <p className="budget-pace">
              You can spend about{' '}
              <strong>{formatINR(Math.floor(overall.remaining / daysLeft))}</strong> a day for the
              rest of the month.
            </p>
          )}
          <div className="budget-list">
            {monthly.map((s) => (
              <BudgetItem key={s.budget.id} status={s} label={label(s)} open={open} />
            ))}
            <AddTile
              label="Add a monthly limit"
              onClick={() => {
                open({ type: 'budget', period: 'monthly' });
              }}
            />
          </div>
        </Section>
      </div>

      <div className="finance-grid__side">
        <Section
          title={`${yearOf(today)}`}
          icon={CalendarRange}
          description="Annual budgets"
          className="finance-card"
        >
          <div className="budget-list">
            {annual.map((s) => (
              <BudgetItem key={s.budget.id} status={s} label={label(s)} open={open} />
            ))}
            <AddTile
              label="Add an annual limit"
              onClick={() => {
                open({ type: 'budget', period: 'annual' });
              }}
            />
          </div>
        </Section>

        {unbudgeted.length > 0 && (
          <Section
            title="Without a limit"
            icon={CircleDashed}
            description="Spent this month in groups with no monthly budget."
            className="finance-card"
          >
            <ul className="unbudgeted">
              {unbudgeted.map((c) => (
                <li key={c.category}>
                  <span className="unbudgeted__name">{c.label}</span>
                  <span className="unbudgeted__amount">{formatINR(c.amount)}</span>
                  <button
                    type="button"
                    className="link-button"
                    aria-label={`Set a limit for ${c.label}`}
                    onClick={() => {
                      open({ type: 'budget', period: 'monthly', category: c.category });
                    }}
                  >
                    Set limit
                  </button>
                </li>
              ))}
            </ul>
          </Section>
        )}
      </div>
    </div>
  );
}
