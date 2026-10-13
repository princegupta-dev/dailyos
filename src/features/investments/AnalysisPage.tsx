import {
  ArrowDownLeft,
  ArrowUpRight,
  BadgeIndianRupee,
  BarChart3,
  ChartPie,
  ChevronLeft,
  ChevronRight,
  Coins,
  Goal,
  Percent,
  PiggyBank,
  Table2,
  TrendingUp,
} from 'lucide-react';
import { useSearchParams } from 'react-router';
import { Section } from '@/components/Section';
import { SegmentedControl } from '@/components/SegmentedControl';
import { ACCOUNT_TYPE_INFO } from '@/domain/finance';
import { addMonths } from '@/lib/dates';
import { formatINR } from '@/lib/money';
import {
  breakdownBy,
  goalProgress,
  inRange,
  liabilityIds,
  monthlyTotals,
  monthOf,
  monthRange,
  monthsEnding,
  monthsOfYear,
  portfolioSummary,
  spendingByGroup,
  totalsOf,
  wealthTrend,
  yearOf,
  yearRange,
  type FlowTotals,
  type MonthTotals,
} from '@/services/finance.service';
import { percent } from '../reviews/format';
import {
  AllocationBar,
  BreakdownBars,
  CashflowChart,
  GroupBreakdown,
  WealthTrend,
} from './FinanceCharts';
import { GoalItem, MoneyKpi } from './FinanceCards';
import { useFinance } from './financeContext';
import { investmentColor, monthName, SERIES, shortMonthName } from './financeUi';

type Scope = 'month' | 'year';

const SCOPES: readonly { value: Scope; label: string }[] = [
  { value: 'month', label: 'Month' },
  { value: 'year', label: 'Year' },
];

const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;
const YEAR_PATTERN = /^\d{4}$/;

/** Monthly and yearly summaries, compared with the period before, with charts. */
export function AnalysisPage() {
  const { data, today, open } = useFinance();
  const [params, setParams] = useSearchParams();
  const scope: Scope = params.get('scope') === 'year' ? 'year' : 'month';
  const rawAt = params.get('at') ?? '';
  const currentMonth = monthOf(today);
  const currentYear = yearOf(today);

  // The period on screen, never later than today's month or year.
  const month =
    scope === 'month' && MONTH_PATTERN.test(rawAt) && rawAt <= currentMonth ? rawAt : currentMonth;
  const year =
    scope === 'year' && YEAR_PATTERN.test(rawAt) && Number(rawAt) <= currentYear
      ? Number(rawAt)
      : currentYear;

  const range = scope === 'month' ? monthRange(month) : yearRange(year);
  const previousMonth = monthOf(addMonths(`${month}-01`, -1));
  const previousRange = scope === 'month' ? monthRange(previousMonth) : yearRange(year - 1);
  const upToToday = data.entries.filter((e) => e.date <= today);
  const inPeriod = inRange(upToToday, range);
  const liabilities = liabilityIds(data.accounts);
  const totals = totalsOf(inPeriod, liabilities);
  const previous = totalsOf(inRange(upToToday, previousRange), liabilities);
  const previousName = scope === 'month' ? monthName(previousMonth) : String(year - 1);
  const title = scope === 'month' ? monthName(month) : String(year);

  const chartMonths =
    scope === 'month'
      ? monthsEnding(`${month}-01`, 6)
      : monthsOfYear(year).filter((m) => m <= currentMonth);
  const trendMonths =
    scope === 'month'
      ? monthsEnding(`${month}-01`, 12)
      : monthsOfYear(year).filter((m) => m <= currentMonth);
  const months = monthlyTotals(upToToday, chartMonths, liabilities);
  const portfolio = portfolioSummary(data, today);
  // Where money went, kept apart: spending, investing, saving, and paying down debt.
  const outflows = [
    { key: 'spent', label: 'Spending', value: totals.expenses, color: SERIES[1] ?? '' },
    { key: 'invested', label: 'Investing', value: totals.invested, color: SERIES[0] ?? '' },
    { key: 'saved', label: 'Saving', value: totals.saved, color: SERIES[2] ?? '' },
    { key: 'repaid', label: 'Debt repaid', value: totals.repaid, color: SERIES[6] ?? '' },
  ].filter((p) => p.value > 0);
  const outflowTotal = outflows.reduce((sum, p) => sum + p.value, 0);
  const goals = data.goals
    .filter((g) => g.year === (scope === 'month' ? yearOf(range.from) : year))
    .map((g) => goalProgress(g, data.entries, today));

  const go = (nextScope: Scope, at: string) => {
    setParams(
      () => {
        const next = new URLSearchParams();
        if (nextScope === 'year') next.set('scope', 'year');
        next.set('at', at);
        return next;
      },
      { replace: true },
    );
  };
  const step = (delta: number) => {
    if (scope === 'month') go('month', monthOf(addMonths(`${month}-01`, delta)));
    else go('year', String(year + delta));
  };
  const atLatest = scope === 'month' ? month >= currentMonth : year >= currentYear;

  return (
    <div className="finance-stack">
      <div className="finance-toolbar">
        <SegmentedControl
          label="Summary period"
          value={scope}
          options={SCOPES}
          onChange={(value) => {
            go(
              value,
              value === 'month'
                ? scope === 'year' && year < currentYear
                  ? `${year}-12`
                  : currentMonth
                : month.slice(0, 4),
            );
          }}
        />
        <div className="period-stepper">
          <button
            type="button"
            className="icon-button"
            aria-label={scope === 'month' ? 'Previous month' : 'Previous year'}
            onClick={() => {
              step(-1);
            }}
          >
            <ChevronLeft size={18} aria-hidden="true" />
          </button>
          <h2 className="period-stepper__title" aria-live="polite">
            {title}
          </h2>
          <button
            type="button"
            className="icon-button"
            aria-label={scope === 'month' ? 'Next month' : 'Next year'}
            disabled={atLatest}
            onClick={() => {
              step(1);
            }}
          >
            <ChevronRight size={18} aria-hidden="true" />
          </button>
        </div>
      </div>

      <dl className="kpis kpis--three">
        <MoneyKpi
          icon={ArrowDownLeft}
          label="Income"
          value={formatINR(totals.income, { compact: true })}
          foot={<Change now={totals.income} before={previous.income} name={previousName} />}
        />
        <MoneyKpi
          icon={ArrowUpRight}
          label="Expenses"
          value={formatINR(totals.expenses, { compact: true })}
          foot={
            <Change
              now={totals.expenses}
              before={previous.expenses}
              name={previousName}
              lowerIsBetter
            />
          }
        />
        <MoneyKpi
          icon={Percent}
          label="Savings rate"
          value={percent(totals.savingsRate)}
          alert={totals.savingsRate !== null && totals.savingsRate < 0}
          foot={`${percent(previous.savingsRate)} in ${previousName}`}
        />
        <MoneyKpi
          icon={TrendingUp}
          label="Invested"
          value={formatINR(totals.invested, { compact: true })}
          foot={<Change now={totals.invested} before={previous.invested} name={previousName} />}
        />
        <MoneyKpi
          icon={PiggyBank}
          label="Saved"
          value={formatINR(totals.saved, { compact: true })}
          foot={<Change now={totals.saved} before={previous.saved} name={previousName} />}
        />
        <MoneyKpi
          icon={Coins}
          label="Left unallocated"
          value={formatINR(totals.unallocated, { compact: true })}
          alert={totals.unallocated < 0}
          foot={
            totals.unallocated < 0 ? 'Drew on earlier balance' : 'Not spent, saved, or invested'
          }
        />
      </dl>

      <div className="finance-grid">
        <div className="finance-grid__main">
          <Section
            title="Income vs. expenses"
            icon={BarChart3}
            description={
              scope === 'month' ? 'Six months to the chosen month' : `Each month of ${year}`
            }
            className="finance-card"
          >
            <CashflowChart key={`${scope}-${chartMonths.at(-1) ?? ''}`} months={months} />
          </Section>

          <Section
            title="Wealth built"
            icon={TrendingUp}
            description="Savings and investments put away, as a running total"
            className="finance-card"
          >
            <WealthTrend
              key={`${scope}-${trendMonths.at(-1) ?? ''}`}
              points={wealthTrend(upToToday, trendMonths)}
            />
          </Section>

          <Section title="Summary table" icon={Table2} className="finance-card">
            <SummaryTable months={months} total={totals} totalLabel={`${title} total`} />
          </Section>
        </div>

        <div className="finance-grid__side">
          <Section
            title="Where your money went"
            icon={Coins}
            description="Spending, investing, saving, and debt repaid, kept separate"
            className="finance-card"
          >
            {outflows.length === 0 ? (
              <p className="quiet-note">Nothing went out in this period.</p>
            ) : (
              <AllocationBar
                label="Money out"
                parts={outflows.map((p) => ({ ...p, share: p.value / outflowTotal }))}
              />
            )}
            {totals.transferred > 0 && (
              <p className="quiet-note">
                {formatINR(totals.transferred)} moved between your own accounts isn’t counted.
              </p>
            )}
          </Section>

          <Section
            title="Spending by group"
            icon={ChartPie}
            description={`${title}. Open a group for its categories.`}
            className="finance-card"
          >
            <GroupBreakdown
              groups={spendingByGroup(inPeriod, data.categories)}
              empty="No expenses in this period."
            />
          </Section>

          <Section
            title="Where it came from"
            icon={BadgeIndianRupee}
            description={title}
            className="finance-card"
          >
            <BreakdownBars
              items={breakdownBy(inPeriod, 'income', data.categories)}
              empty="No income in this period."
            />
          </Section>

          <Section
            title="Investment allocation"
            icon={ChartPie}
            description="As of today"
            className="finance-card"
          >
            {portfolio.allocation.length === 0 ? (
              <p className="quiet-note">Record investments to see how they’re split.</p>
            ) : (
              <AllocationBar
                label="Investment allocation"
                parts={portfolio.allocation.map((s) => ({
                  key: s.type,
                  label: ACCOUNT_TYPE_INFO[s.type].label,
                  value: s.value,
                  share: s.share,
                  color: investmentColor(s.type),
                }))}
              />
            )}
          </Section>

          {goals.length > 0 && (
            <Section title="Goal progress" icon={Goal} className="finance-card">
              <div className="goal-list">
                {goals.map((g) => (
                  <GoalItem key={g.goal.id} progress={g} open={open} />
                ))}
              </div>
            </Section>
          )}
        </div>
      </div>
    </div>
  );
}

interface ChangeProps {
  now: number;
  before: number;
  name: string;
  /** For expenses: going down is the good direction. */
  lowerIsBetter?: boolean;
}

/** "▲ 12% vs September", or the earlier amount when a percentage would mislead. */
function Change({ now, before, name, lowerIsBetter = false }: ChangeProps) {
  if (before === 0) return <>{now === 0 ? `None in ${name} either` : `Nothing in ${name}`}</>;
  const change = (now - before) / Math.abs(before);
  if (Math.abs(change) < 0.005) return <>Same as {name}</>;
  const up = change > 0;
  const good = lowerIsBetter ? !up : up;
  return (
    <span className={`change change--${good ? 'good' : 'bad'}`}>
      <span aria-hidden="true">{up ? '▲' : '▼'}</span>
      <span className="visually-hidden">{up ? 'Up' : 'Down'}</span> {percent(Math.abs(change))} vs{' '}
      {name}
    </span>
  );
}

/** The numbers behind the charts, month by month, with the period's total. */
function SummaryTable({
  months,
  total,
  totalLabel,
}: {
  months: readonly MonthTotals[];
  total: FlowTotals;
  totalLabel: string;
}) {
  const row = (t: FlowTotals) => (
    <>
      <td>{formatINR(t.income)}</td>
      <td>{formatINR(t.expenses)}</td>
      <td>{formatINR(t.invested)}</td>
      <td>{formatINR(t.saved)}</td>
      <td>{percent(t.savingsRate)}</td>
    </>
  );
  return (
    <div className="table-scroll">
      <table className="trend-table">
        <thead>
          <tr>
            <th scope="col">Month</th>
            <th scope="col">Income</th>
            <th scope="col">Expenses</th>
            <th scope="col">Invested</th>
            <th scope="col">Saved</th>
            <th scope="col">Rate</th>
          </tr>
        </thead>
        <tbody>
          {months.map((m) => (
            <tr key={m.month}>
              <th scope="row">
                {shortMonthName(m.month)} {m.month.slice(0, 4)}
              </th>
              {row(m.totals)}
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <th scope="row">{totalLabel}</th>
            {row(total)}
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
