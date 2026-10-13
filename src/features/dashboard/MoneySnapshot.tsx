import { ArrowDownLeft, ArrowUpRight, PiggyBank, Wallet } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { LiveView } from '@/components/LiveView';
import { Section } from '@/components/Section';
import { getFinanceData } from '@/db/repositories/finance';
import { useLiveData } from '@/hooks/useLiveData';
import { formatINR } from '@/lib/money';
import {
  balanceSheet,
  budgetStatuses,
  dueRecurring,
  inRange,
  isFinanceEmpty,
  monthOf,
  monthRange,
  totalsOf,
  yearOf,
  type FinanceData,
} from '@/services/finance.service';
import { BudgetItem, MoneyKpi, QuickActions, RecurringList } from '../investments/FinanceCards';
import { FinanceDialogs } from '../investments/FinanceDialogs';
import type { FinanceDialogRequest, OpenFinanceDialog } from '../investments/financeUi';

const DUE = 3;

/**
 * This month's key numbers, what's due, the budget, and quick add. Breakdowns, goals, and
 * history live on Investments.
 */
export function MoneySnapshot({ today }: { today: string }) {
  const finance = useLiveData(getFinanceData);
  const [dialog, setDialog] = useState<FinanceDialogRequest | null>(null);

  return (
    <Section
      title="Money"
      icon={Wallet}
      meta={<Link to="/investments">Investments</Link>}
      className="money-snapshot"
    >
      <LiveView
        state={finance}
        loadingLabel="Loading your finances…"
        skeleton={<div className="skeleton skeleton--card" style={{ height: 160 }} />}
      >
        {(data) => (
          <>
            <SnapshotBody data={data} today={today} open={setDialog} />
            <FinanceDialogs
              request={dialog}
              data={data}
              today={today}
              onClose={() => {
                setDialog(null);
              }}
            />
          </>
        )}
      </LiveView>
    </Section>
  );
}

interface SnapshotBodyProps {
  data: FinanceData;
  today: string;
  open: OpenFinanceDialog;
}

function SnapshotBody({ data, today, open }: SnapshotBodyProps) {
  const year = yearOf(today);
  if (isFinanceEmpty(data)) {
    return (
      <div className="money-snapshot__empty">
        <QuickActions open={open} year={year} />
      </div>
    );
  }

  const upToToday = data.entries.filter((e) => e.date <= today);
  const thisMonth = inRange(upToToday, monthRange(monthOf(today)));
  const totals = totalsOf(thisMonth);
  const sheet = balanceSheet(data, today);
  const due = dueRecurring(data.recurring, today);
  const overall = budgetStatuses(data.budgets, data.entries, today, data.categories).find(
    (b) => b.budget.period === 'monthly' && b.budget.category === 'all',
  );

  return (
    <div className="money-snapshot__body">
      <div>
        <p className="money-snapshot__subtitle">This month</p>
        <dl className="kpis money-snapshot__kpis">
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
            label="Put away"
            value={formatINR(totals.saved + totals.invested, { compact: true })}
          />
          <MoneyKpi
            icon={Wallet}
            label="Net worth"
            value={formatINR(sheet.netWorth, { compact: true })}
          />
        </dl>
      </div>

      {due.length > 0 && (
        <div>
          <p className="money-snapshot__subtitle">Payments due</p>
          <RecurringList rules={due.slice(0, DUE)} data={data} today={today} open={open} />
        </div>
      )}

      {overall && <BudgetItem status={overall} label="Monthly budget" />}

      <QuickActions open={open} year={year} />
    </div>
  );
}
