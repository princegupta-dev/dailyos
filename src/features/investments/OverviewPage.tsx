import {
  ArrowDownLeft,
  BellRing,
  ArrowUpRight,
  BarChart3,
  ChartPie,
  Goal,
  Percent,
  PiggyBank,
  ReceiptIndianRupee,
  Sprout,
  Wallet,
  Zap,
} from 'lucide-react';
import { Link } from 'react-router';
import { Section } from '@/components/Section';
import { loadSampleFinance } from '@/db/repositories/finance';
import { useAction } from '@/hooks/useAction';
import { formatINR } from '@/lib/money';
import {
  balanceSheet,
  budgetStatuses,
  dueRecurring,
  filterEntries,
  goalProgress,
  inRange,
  isFinanceEmpty,
  monthlyTotals,
  monthOf,
  monthRange,
  monthsEnding,
  portfolioSummary,
  spendingByGroup,
  totalsOf,
  upcomingRecurring,
  yearOf,
  type BalanceSheet,
  type PortfolioSummary,
} from '@/services/finance.service';
import { percent } from '../reviews/format';
import { BreakdownBars, CashflowChart } from './FinanceCharts';
import {
  AddTile,
  BudgetItem,
  EntryList,
  GoalItem,
  MoneyKpi,
  QuickActions,
  RecurringList,
} from './FinanceCards';
import { useFinance } from './financeContext';
import { monthName, type OpenFinanceDialog } from './financeUi';

const RECENT = 6;
const CASHFLOW_MONTHS = 6;

/** Where your money stands today, this month at a glance, and what changed recently. */
export function FinanceOverviewPage() {
  const { data, today, open } = useFinance();
  if (isFinanceEmpty(data)) return <FinanceWelcome open={open} year={yearOf(today)} />;

  const month = monthOf(today);
  const year = yearOf(today);
  const upToToday = data.entries.filter((e) => e.date <= today);
  const thisMonth = inRange(upToToday, monthRange(month));
  const totals = totalsOf(thisMonth);
  const sheet = balanceSheet(data, today);
  const portfolio = portfolioSummary(data, today);
  const due = dueRecurring(data.recurring, today);
  const soon = upcomingRecurring(data.recurring, today, 7);
  const monthBudgets = budgetStatuses(data.budgets, data.entries, today, data.categories).filter(
    (b) => b.budget.period === 'monthly',
  );
  const overall = monthBudgets.find((b) => b.budget.category === 'all');
  const goals = data.goals
    .filter((g) => g.year === year)
    .map((g) => goalProgress(g, data.entries, today));
  const recent = filterEntries(data.entries, {}, data).slice(0, RECENT);

  return (
    <div className="finance-grid">
      <div className="finance-grid__main">
        <NetWorthHero sheet={sheet} portfolio={portfolio} />

        {(due.length > 0 || soon.length > 0) && (
          <Section
            title={due.length > 0 ? 'Payments due' : 'Coming up this week'}
            icon={BellRing}
            className="finance-card"
            meta={<Link to="/investments/recurring">Recurring</Link>}
          >
            <RecurringList rules={[...due, ...soon]} data={data} today={today} open={open} />
          </Section>
        )}

        <Section title="Quick add" icon={Zap} className="finance-card finance-card--plain">
          <QuickActions open={open} year={year} />
        </Section>

        <Section
          title="Income vs. expenses"
          icon={BarChart3}
          description={`The last ${CASHFLOW_MONTHS} months. Choose a month for details.`}
          className="finance-card"
          meta={<Link to="/investments/analysis">Analysis</Link>}
        >
          <CashflowChart months={monthlyTotals(upToToday, monthsEnding(today, CASHFLOW_MONTHS))} />
        </Section>

        <Section
          title="Recent transactions"
          icon={ReceiptIndianRupee}
          className="finance-card"
          meta={<Link to="/investments/activity">See all</Link>}
        >
          {recent.length === 0 ? (
            <p className="quiet-note">Nothing recorded yet. Use Quick add to start.</p>
          ) : (
            <EntryList entries={recent} data={data} open={open} />
          )}
        </Section>
      </div>

      <div className="finance-grid__side">
        <section className="finance-month" aria-label={`${monthName(month)} at a glance`}>
          <p className="finance-eyebrow">{monthName(month)}</p>
          <dl className="kpis">
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
            <MoneyKpi
              icon={Percent}
              label="Savings rate"
              value={percent(totals.savingsRate)}
              alert={totals.savingsRate !== null && totals.savingsRate < 0}
              foot={
                totals.savingsRate === null
                  ? 'No income yet'
                  : totals.savingsRate < 0
                    ? 'Spending more than you earn'
                    : 'Of income not spent'
              }
            />
          </dl>
        </section>

        <Section
          title="Spending this month"
          icon={ChartPie}
          className="finance-card"
          meta={<Link to="/investments/budgets">Budgets</Link>}
        >
          {overall && <BudgetItem status={overall} label="Monthly budget" open={open} />}
          <BreakdownBars
            items={spendingByGroup(thisMonth, data.categories)}
            limit={5}
            empty="No expenses recorded this month."
          />
          {!overall && (
            <AddTile
              label="Set a monthly budget"
              onClick={() => {
                open({ type: 'budget', period: 'monthly', category: 'all' });
              }}
            />
          )}
        </Section>

        <Section
          title={`${year} goals`}
          icon={Goal}
          className="finance-card"
          meta={<Link to="/investments/goals">All goals</Link>}
        >
          <div className="goal-list">
            {goals.map((g) => (
              <GoalItem key={g.goal.id} progress={g} open={open} />
            ))}
            {goals.length === 0 && (
              <AddTile
                label="Set a goal for this year"
                onClick={() => {
                  open({ type: 'goal', year });
                }}
              />
            )}
          </div>
        </Section>
      </div>
    </div>
  );
}

/** Net worth with what it's made of. */
function NetWorthHero({ sheet, portfolio }: { sheet: BalanceSheet; portfolio: PortfolioSummary }) {
  return (
    <section className="worth-hero" aria-labelledby="worth-hero-title">
      <p className="worth-hero__eyebrow" id="worth-hero-title">
        <Wallet size={16} aria-hidden="true" /> Net worth
      </p>
      <p className="worth-hero__value">{formatINR(sheet.netWorth)}</p>
      <dl className="worth-hero__parts">
        <div>
          <dt>Bank & cash</dt>
          <dd>{formatINR(sheet.available)}</dd>
        </div>
        <div>
          <dt>Savings</dt>
          <dd>{formatINR(sheet.savings)}</dd>
        </div>
        <div>
          <dt>Investments</dt>
          <dd>
            {formatINR(sheet.investments)}
            {portfolio.gainRate !== null && portfolio.gain !== 0 && (
              <span className="worth-hero__gain">
                {formatINR(portfolio.gain, { signed: true, compact: true })} (
                {portfolio.gain > 0 ? '+' : ''}
                {percent(portfolio.gainRate)})
              </span>
            )}
          </dd>
        </div>
        {sheet.liabilities !== 0 && (
          <div>
            <dt>Loans & cards</dt>
            <dd>−{formatINR(sheet.liabilities)}</dd>
          </div>
        )}
      </dl>
      <p className="worth-hero__note">
        Balances come from your accounts plus everything recorded since.{' '}
        <Link to="/investments/accounts" className="worth-hero__link">
          Accounts & assets
        </Link>
      </p>
    </section>
  );
}

/** First visit: what this section does and the quickest ways to start. */
function FinanceWelcome({ open, year }: { open: OpenFinanceDialog; year: number }) {
  const { run, pending } = useAction();
  return (
    <section className="finance-welcome" aria-labelledby="finance-welcome-title">
      <span className="insights-empty__art" aria-hidden="true">
        <Sprout size={30} />
      </span>
      <h2 id="finance-welcome-title" className="insights-empty__title">
        Your money, next to your habits
      </h2>
      <p className="insights-empty__text">
        Record income, expenses, investments, and savings. You’ll see your net worth, budgets,
        yearly goals, and where your money goes. Everything stays on this device.
      </p>
      <QuickActions open={open} year={year} />
      <div className="finance-welcome__more">
        <button
          type="button"
          className="button button--secondary"
          onClick={() => {
            open({ type: 'salary' });
          }}
        >
          Add your salary
        </button>
        <button
          type="button"
          className="button button--secondary"
          disabled={pending}
          onClick={() => {
            void run(loadSampleFinance, 'Sample data added. Clear it any time in Settings.');
          }}
        >
          Explore with sample data
        </button>
      </div>
    </section>
  );
}
