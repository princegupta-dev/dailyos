import {
  ArrowDownLeft,
  BadgeIndianRupee,
  BriefcaseBusiness,
  CalendarRange,
  History,
  Layers,
  Plus,
} from 'lucide-react';
import { Section } from '@/components/Section';
import { formatINR } from '@/lib/money';
import {
  breakdownBy,
  currentSalary,
  inRange,
  monthlyTotals,
  monthOf,
  monthRange,
  monthsEnding,
  salaryHistory,
  yearOf,
  yearRange,
} from '@/services/finance.service';
import { percent } from '../reviews/format';
import { BreakdownBars } from './FinanceCharts';
import { AddTile, MoneyKpi } from './FinanceCards';
import { useFinance } from './financeContext';
import { monthName, shortDate } from './financeUi';

const HISTORY_MONTHS = 12;

/** Salary, other income sources, and how income has changed over time. */
export function IncomePage() {
  const { data, today, open } = useFinance();
  const salary = currentSalary(data.salaries, today);
  const history = salaryHistory(data.salaries);
  const year = yearOf(today);
  const upToToday = data.entries.filter((e) => e.date <= today);
  const thisYear = inRange(upToToday, yearRange(year));
  const sources = breakdownBy(thisYear, 'income', data.categories);
  const total = sources.reduce((sum, s) => sum + s.amount, 0);
  const fromSalary = sources.find((s) => s.category === 'salary')?.amount ?? 0;
  const monthsSoFar = Number(monthOf(today).slice(5));
  const salaryThisMonth = inRange(upToToday, monthRange(monthOf(today))).some(
    (e) => e.kind === 'income' && e.category === 'salary',
  );
  const months = monthlyTotals(upToToday, monthsEnding(today, HISTORY_MONTHS))
    .filter((m) => m.totals.income > 0)
    .reverse();

  return (
    <div className="finance-grid">
      <div className="finance-grid__main">
        <Section
          title="Salary"
          icon={BriefcaseBusiness}
          className="finance-card"
          meta={
            salary && (
              <button
                type="button"
                className="link-button"
                onClick={() => {
                  open({ type: 'salary', salary });
                }}
              >
                Edit
              </button>
            )
          }
        >
          {salary ? (
            <>
              <dl className="salary-grid">
                <div>
                  <dt>Monthly gross</dt>
                  <dd>{formatINR(salary.monthlyGross)}</dd>
                </div>
                <div>
                  <dt>Monthly in-hand</dt>
                  <dd>{formatINR(salary.monthlyInHand)}</dd>
                </div>
                <div>
                  <dt>Deductions</dt>
                  <dd>
                    {formatINR(salary.monthlyGross - salary.monthlyInHand)}
                    <span className="salary-grid__note">
                      {' '}
                      {percent((salary.monthlyGross - salary.monthlyInHand) / salary.monthlyGross)}
                    </span>
                  </dd>
                </div>
                <div>
                  <dt>Annual CTC</dt>
                  <dd>{salary.annualCtc === undefined ? '—' : formatINR(salary.annualCtc)}</dd>
                </div>
                <div>
                  <dt>Annual gross</dt>
                  <dd>{formatINR(salary.monthlyGross * 12)}</dd>
                </div>
                <div>
                  <dt>Annual in-hand</dt>
                  <dd>{formatINR(salary.monthlyInHand * 12)}</dd>
                </div>
              </dl>
              <p className="quiet-note">
                {salary.employer ? `${salary.employer} · ` : ''}Since{' '}
                {shortDate(salary.effectiveFrom)}. Salary details are for reference; record each
                payment as income so it counts.
              </p>
              <div className="finance-actions finance-actions--start">
                <button
                  type="button"
                  className="button button--primary button--compact"
                  disabled={salaryThisMonth}
                  onClick={() => {
                    open({
                      type: 'entry',
                      kind: 'income',
                      preset: {
                        amount: salary.monthlyInHand,
                        category: 'salary',
                        note: 'Monthly salary',
                      },
                    });
                  }}
                >
                  {salaryThisMonth
                    ? 'This month’s salary is recorded'
                    : `Record ${monthName(monthOf(today))} salary`}
                </button>
                <button
                  type="button"
                  className="button button--secondary button--compact"
                  onClick={() => {
                    open({ type: 'salary' });
                  }}
                >
                  <Plus size={16} aria-hidden="true" /> Add a raise or new job
                </button>
              </div>
            </>
          ) : (
            <>
              <p className="quiet-note">
                Add your gross and in-hand salary to see deductions and annual figures, and to
                record each month’s pay in one tap.
              </p>
              <AddTile
                label="Add your salary"
                onClick={() => {
                  open({ type: 'salary' });
                }}
              />
            </>
          )}
        </Section>

        <Section
          title="Income by month"
          icon={CalendarRange}
          description={`The last ${HISTORY_MONTHS} months`}
          className="finance-card"
        >
          <BreakdownBars
            items={months.map((m) => ({
              category: m.month,
              label: monthName(m.month),
              amount: m.totals.income,
              share: 0,
            }))}
            limit={HISTORY_MONTHS}
            empty="Record income to see it month by month."
            hideShare
          />
        </Section>
      </div>

      <div className="finance-grid__side">
        <dl className="kpis">
          <MoneyKpi
            icon={ArrowDownLeft}
            label={`Income in ${year}`}
            value={formatINR(total, { compact: true })}
            foot={`Avg. ${formatINR(Math.round(total / monthsSoFar), { compact: true })}/month`}
          />
          <MoneyKpi
            icon={Layers}
            label="Beyond salary"
            value={formatINR(total - fromSalary, { compact: true })}
            foot={total === 0 ? undefined : `${percent((total - fromSalary) / total)} of income`}
          />
        </dl>

        <Section
          title="Income sources"
          icon={BadgeIndianRupee}
          description={`${year} so far`}
          className="finance-card"
          meta={
            <button
              type="button"
              className="link-button"
              onClick={() => {
                open({ type: 'entry', kind: 'income', preset: { category: 'freelance' } });
              }}
            >
              Add income
            </button>
          }
        >
          <BreakdownBars items={sources} empty="No income recorded this year." />
        </Section>

        {history.length > 0 && (
          <Section title="Salary history" icon={History} className="finance-card">
            <ol className="salary-history">
              {history.map(({ salary: s, change }) => (
                <li key={s.id}>
                  <button
                    type="button"
                    className="salary-history__item"
                    onClick={() => {
                      open({ type: 'salary', salary: s });
                    }}
                  >
                    <span className="salary-history__date">{shortDate(s.effectiveFrom)}</span>
                    <span className="salary-history__amount">
                      {formatINR(s.monthlyInHand)}/month in-hand
                    </span>
                    <span className="salary-history__meta">
                      {formatINR(s.monthlyGross)} gross
                      {s.note ? ` · ${s.note}` : ''}
                      {change !== null && (
                        <span
                          className={change >= 0 ? 'salary-history__up' : 'salary-history__down'}
                        >
                          {' '}
                          {change >= 0 ? '+' : ''}
                          {percent(change)}
                        </span>
                      )}
                    </span>
                  </button>
                </li>
              ))}
            </ol>
          </Section>
        )}
      </div>
    </div>
  );
}
