import { BellRing, CalendarClock, Plus, Repeat } from 'lucide-react';
import { EmptyState } from '@/components/EmptyState';
import { Section } from '@/components/Section';
import { recordAllDue } from '@/db/repositories/finance';
import { useAction } from '@/hooks/useAction';
import { formatINR } from '@/lib/money';
import { dueRecurring, monthlyEquivalent, upcomingRecurring } from '@/services/finance.service';
import { plural } from '../reviews/format';
import { MoneyKpi, RecurringList } from './FinanceCards';
import { useFinance } from './financeContext';

const UPCOMING_DAYS = 14;

/**
 * Rent, EMIs, SIPs, subscriptions, and other payments that repeat. Due ones are recorded with
 * one tap (or all at once); nothing is recorded without you, so the ledger stays yours.
 */
export function RecurringPage() {
  const { data, today, open } = useFinance();
  const { run, pending } = useAction();
  const active = data.recurring.filter((r) => r.endedAt === undefined);
  const ended = data.recurring.filter((r) => r.endedAt !== undefined);
  const due = dueRecurring(data.recurring, today);
  const upcoming = upcomingRecurring(data.recurring, today, UPCOMING_DAYS);
  const later = active.filter((r) => !due.includes(r) && !upcoming.includes(r));
  const monthlyOut = active
    .filter((r) => r.kind === 'expense')
    .reduce((sum, r) => sum + monthlyEquivalent(r), 0);
  const monthlyPutAway = active
    .filter((r) => (r.kind === 'investment' || r.kind === 'saving') && !r.withdrawal)
    .reduce((sum, r) => sum + monthlyEquivalent(r), 0);

  const addButton = (
    <button
      type="button"
      className="link-button"
      onClick={() => {
        open({ type: 'recurring', kind: 'expense' });
      }}
    >
      <Plus size={16} aria-hidden="true" /> Add recurring
    </button>
  );

  if (data.recurring.length === 0) {
    return (
      <div className="finance-stack">
        <EmptyState
          icon={Repeat}
          title="No recurring payments yet"
          description="Add rent, EMIs, SIPs, subscriptions, or support for family. When one is due, record it in one tap."
        />
        <div className="finance-actions">
          <button
            type="button"
            className="button button--primary"
            onClick={() => {
              open({ type: 'recurring', kind: 'expense' });
            }}
          >
            Add a recurring payment
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="finance-stack">
      <dl className="kpis kpis--three" aria-label="Recurring at a glance">
        <MoneyKpi
          icon={BellRing}
          label="Due now"
          value={String(due.length)}
          foot={
            due.length === 0
              ? 'All caught up'
              : `${formatINR(due.reduce((s, r) => s + r.amount, 0))} to record`
          }
        />
        <MoneyKpi
          icon={Repeat}
          label="Fixed spending"
          value={formatINR(monthlyOut, { compact: true })}
          foot="Recurring expenses per month"
        />
        <MoneyKpi
          icon={CalendarClock}
          label="Put away"
          value={formatINR(monthlyPutAway, { compact: true })}
          foot="Recurring SIPs and savings per month"
        />
      </dl>

      {due.length > 0 && (
        <Section
          title="Due now"
          icon={BellRing}
          description="Record each one as paid, or skip it this time."
          className="finance-card"
          meta={
            due.length > 1 ? (
              <button
                type="button"
                className="link-button"
                disabled={pending}
                onClick={() => {
                  void run(recordAllDue, `Recorded ${plural(due.length, 'payment')}`);
                }}
              >
                Record all
              </button>
            ) : undefined
          }
        >
          <RecurringList rules={due} data={data} today={today} open={open} />
        </Section>
      )}

      {upcoming.length > 0 && (
        <Section
          title="Coming up"
          icon={CalendarClock}
          description={`In the next ${UPCOMING_DAYS} days`}
          className="finance-card"
        >
          <RecurringList rules={upcoming} data={data} today={today} open={open} />
        </Section>
      )}

      <Section title="All schedules" icon={Repeat} className="finance-card" meta={addButton}>
        {later.length === 0 ? (
          <p className="quiet-note">Everything active is listed above.</p>
        ) : (
          <RecurringList rules={later} data={data} today={today} open={open} />
        )}
        {ended.length > 0 && (
          <details className="disclosure">
            <summary className="disclosure__summary">Ended ({ended.length})</summary>
            <div className="disclosure__body">
              <RecurringList rules={ended} data={data} today={today} open={open} />
            </div>
          </details>
        )}
      </Section>
    </div>
  );
}
