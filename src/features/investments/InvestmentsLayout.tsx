import { Plus } from 'lucide-react';
import { useState } from 'react';
import { NavLink, Outlet } from 'react-router';
import { LiveView } from '@/components/LiveView';
import { PageHero } from '@/components/PageHero';
import { getFinanceData } from '@/db/repositories/finance';
import { useLiveData } from '@/hooks/useLiveData';
import { useToday } from '@/hooks/useToday';
import type { FinanceOutlet } from './financeContext';
import { FinanceDialogs } from './FinanceDialogs';
import type { FinanceDialogRequest } from './financeUi';

const TABS = [
  { to: '/investments', label: 'Overview', end: true },
  { to: '/investments/activity', label: 'Activity' },
  { to: '/investments/accounts', label: 'Accounts' },
  { to: '/investments/recurring', label: 'Recurring' },
  { to: '/investments/budgets', label: 'Budgets' },
  { to: '/investments/goals', label: 'Goals' },
  { to: '/investments/income', label: 'Income' },
  { to: '/investments/analysis', label: 'Analysis' },
] as const;

/**
 * The Expense Tracker (shown as Investments): income, spending, accounts and assets,
 * budgets, goals, and investments, alongside the Habit Tracker. Loads every finance record
 * once (live) and shares it, with the dialogs, with whichever screen is open.
 */
export function InvestmentsLayout() {
  const today = useToday();
  const finance = useLiveData(getFinanceData);
  const [dialog, setDialog] = useState<FinanceDialogRequest | null>(null);

  return (
    <div className="finance-page">
      <PageHero
        eyebrow="Expense Tracker"
        title="Investments"
        subtitle={
          <>
            Income, spending, accounts, and investments, <em>all in one place</em>.
          </>
        }
        actions={
          <button
            type="button"
            className="hero-cta"
            aria-label="Add transaction"
            onClick={() => {
              setDialog({ type: 'entry' });
            }}
          >
            <Plus size={20} aria-hidden="true" />
            <span className="hero-cta__label">Add</span>
          </button>
        }
      />

      <nav className="finance-tabs" aria-label="Investments">
        {TABS.map((tab) => (
          <NavLink key={tab.to} to={tab.to} end={'end' in tab} className="finance-tabs__link">
            {tab.label}
          </NavLink>
        ))}
      </nav>

      <LiveView
        state={finance}
        loadingLabel="Loading your finances…"
        skeleton={<FinanceSkeleton />}
      >
        {(data) => (
          <>
            <Outlet context={{ data, today, open: setDialog } satisfies FinanceOutlet} />
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
    </div>
  );
}

function FinanceSkeleton() {
  return (
    <div className="finance-grid">
      <div className="finance-grid__main">
        <div className="skeleton skeleton--card" style={{ height: 200 }} />
        <div className="skeleton skeleton--card" style={{ height: 260 }} />
      </div>
      <div className="finance-grid__side">
        <div className="skeleton skeleton--card" style={{ height: 180 }} />
        <div className="skeleton skeleton--card" style={{ height: 220 }} />
      </div>
    </div>
  );
}
