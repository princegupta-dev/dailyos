import {
  Archive,
  BriefcaseBusiness,
  ChartPie,
  CreditCard,
  Landmark,
  LifeBuoy,
  PiggyBank,
  Plus,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { Section } from '@/components/Section';
import {
  ACCOUNT_GROUP_LABELS,
  ACCOUNT_TYPE_INFO,
  accountGroupOf,
  accountTypeLabel,
  SAVINGS_POT_LABELS,
  type AccountGroup,
} from '@/domain/finance';
import { useSettings } from '@/hooks/useToday';
import { formatINR } from '@/lib/money';
import {
  accountSummaries,
  balanceSheet,
  portfolioSummary,
  savingsSummary,
  untrackedMoney,
  type AccountSummary,
} from '@/services/finance.service';
import { percent } from '../reviews/format';
import { AllocationBar, Meter } from './FinanceCharts';
import { AddTile, MoneyKpi } from './FinanceCards';
import { useFinance } from './financeContext';
import { investmentColor, shortDate, type OpenFinanceDialog } from './financeUi';

const GROUP_ICONS = { cash: Landmark, investment: BriefcaseBusiness, liability: CreditCard };
const GROUP_HINTS: Record<AccountGroup, string> = {
  cash: 'Bank accounts, cash in hand, wallets, and kitties.',
  investment: 'Funds, SIPs, deposits, gold, stocks, bonds, PPF, and more.',
  liability: 'What you owe. Repayments lower it and aren’t counted as spending.',
};

/**
 * Every account and asset in one place: balances, investment values and gains, what you owe,
 * savings, and the emergency fund. Balances come from the last figure you entered plus every
 * transaction since, so updating one from a statement is enough to stay accurate.
 */
export function AccountsPage() {
  const { data, today, open } = useFinance();
  const settings = useSettings();
  const [showArchived, setShowArchived] = useState(false);
  const sheet = balanceSheet(data, today);
  const summaries = accountSummaries(data.accounts, data.entries, today);
  const portfolio = portfolioSummary(data, today);
  const savings = savingsSummary(data, today, settings?.emergencyFundMonths);
  const untracked = untrackedMoney(data.entries, today);
  const archived = summaries.filter((s) => s.account.archivedAt);
  const visible = summaries.filter((s) => showArchived || !s.account.archivedAt);
  const byGroup = (group: AccountGroup) =>
    visible
      .filter((s) => accountGroupOf(s.account.type) === group)
      .sort((a, b) => b.value - a.value || a.account.name.localeCompare(b.account.name));
  const gainUp = portfolio.gain >= 0;

  return (
    <div className="finance-stack">
      <dl className="kpis kpis--three" aria-label="Your accounts at a glance">
        <MoneyKpi
          icon={Wallet}
          label="Net worth"
          value={formatINR(sheet.netWorth, { compact: true })}
          alert={sheet.netWorth < 0}
          foot="Everything you have, minus what you owe"
        />
        <MoneyKpi
          icon={Landmark}
          label="Bank & cash"
          value={formatINR(sheet.available, { compact: true })}
          alert={sheet.available < 0}
        />
        <MoneyKpi
          icon={PiggyBank}
          label="Savings"
          value={formatINR(sheet.savings, { compact: true })}
        />
        <MoneyKpi
          icon={gainUp ? TrendingUp : TrendingDown}
          label="Investments"
          value={formatINR(sheet.investments, { compact: true })}
          foot={
            portfolio.gainRate === null || portfolio.invested === 0
              ? undefined
              : `${formatINR(portfolio.gain, { compact: true, signed: true })} (${percent(portfolio.gainRate)}) on ${formatINR(portfolio.invested, { compact: true })}`
          }
        />
        <MoneyKpi
          icon={CreditCard}
          label="Loans & cards"
          value={formatINR(sheet.liabilities, { compact: true })}
          foot={sheet.liabilities > 0 ? 'Owed' : 'Nothing owed'}
        />
      </dl>

      <div className="finance-grid">
        <div className="finance-grid__main">
          {(['cash', 'investment', 'liability'] as const).map((group) => (
            <AccountGroupSection
              key={group}
              group={group}
              rows={byGroup(group)}
              untracked={
                group === 'cash'
                  ? untracked.cash
                  : group === 'investment'
                    ? portfolio.unassigned
                    : 0
              }
              open={open}
            >
              {group === 'investment' && portfolio.allocation.length > 0 && (
                <div className="finance-block finance-block--flush">
                  <h3 className="finance-subtitle">Allocation</h3>
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
                </div>
              )}
            </AccountGroupSection>
          ))}
          {archived.length > 0 && (
            <button
              type="button"
              className="link-button"
              aria-pressed={showArchived}
              onClick={() => {
                setShowArchived((v) => !v);
              }}
            >
              <Archive size={16} aria-hidden="true" />
              {showArchived ? 'Hide archived accounts' : `Show ${archived.length} archived`}
            </button>
          )}
        </div>

        <div className="finance-grid__side">
          <Section
            title="Savings"
            icon={PiggyBank}
            className="finance-card"
            meta={
              <button
                type="button"
                className="link-button"
                onClick={() => {
                  open({ type: 'entry', kind: 'saving' });
                }}
              >
                Add to savings
              </button>
            }
          >
            <dl className="savings-split">
              {(['general', 'emergency'] as const).map((pot) => (
                <div key={pot}>
                  <dt>{SAVINGS_POT_LABELS[pot]}</dt>
                  <dd>{formatINR(savings[pot])}</dd>
                </div>
              ))}
              <div>
                <dt>Saved this month</dt>
                <dd>{formatINR(savings.thisMonth, { signed: savings.thisMonth < 0 })}</dd>
              </div>
              <div>
                <dt>Monthly average</dt>
                <dd>{savings.monthlyAverage === null ? '—' : formatINR(savings.monthlyAverage)}</dd>
              </div>
            </dl>
            <p className="quiet-note">
              Mark a bank account or kitty as holding savings to count its balance here.
            </p>
          </Section>

          <Section title="Emergency fund" icon={LifeBuoy} className="finance-card">
            {savings.emergencyTarget === null ? (
              <p className="quiet-note">
                Record a month of expenses to see how many months your emergency fund covers.
              </p>
            ) : (
              <div className="emergency">
                <p className="emergency__lead">
                  <strong>
                    {(savings.emergencyMonths ?? 0).toFixed(1)} of {savings.targetMonths}
                  </strong>{' '}
                  months of expenses covered
                </p>
                <Meter
                  fraction={savings.emergency / savings.emergencyTarget}
                  tone={savings.emergency >= savings.emergencyTarget ? 'done' : 'ok'}
                  label={`${percent(savings.emergency / savings.emergencyTarget)} of a ${savings.targetMonths}-month emergency fund`}
                />
                <p className="emergency__note">
                  {savings.emergency >= savings.emergencyTarget ? (
                    <>
                      <ShieldCheck size={14} aria-hidden="true" /> Fully funded at{' '}
                      {formatINR(savings.emergencyTarget)}.
                    </>
                  ) : (
                    <>
                      {formatINR(savings.emergencyTarget - savings.emergency)} more reaches{' '}
                      {formatINR(savings.emergencyTarget)}, based on average spending of{' '}
                      {formatINR(savings.monthlyExpenses ?? 0)}/month.
                    </>
                  )}
                </p>
                <Link to="/settings" className="emergency__settings">
                  Change the target in Settings
                </Link>
              </div>
            )}
          </Section>

          <Section title="How balances work" icon={ChartPie} className="finance-card">
            <p className="quiet-note">
              Each balance is the figure you entered, plus every transaction since. Transfers
              between your accounts move money without counting as income or spending, and
              investment gains stay separate from the money you put in. Update a balance from your
              statement any time; no bank connection is needed.
            </p>
          </Section>
        </div>
      </div>
    </div>
  );
}

interface AccountGroupSectionProps {
  group: AccountGroup;
  rows: readonly AccountSummary[];
  /** Money recorded without an account in this group. */
  untracked: number;
  open: OpenFinanceDialog;
  children?: ReactNode;
}

function AccountGroupSection({ group, rows, untracked, open, children }: AccountGroupSectionProps) {
  const total = rows.reduce((sum, r) => sum + r.value, 0) + untracked;
  return (
    <Section
      title={ACCOUNT_GROUP_LABELS[group]}
      icon={GROUP_ICONS[group]}
      description={GROUP_HINTS[group]}
      className="finance-card"
      meta={<span className="account-group__total">{formatINR(total)}</span>}
    >
      {children}
      <ul className="account-list">
        {rows.map((r) => (
          <li key={r.account.id}>
            <AccountCard summary={r} open={open} />
          </li>
        ))}
      </ul>
      {untracked !== 0 && (
        <p className="quiet-note">
          {formatINR(untracked)} recorded without an account is included
          {group === 'investment' ? ', at cost' : ''}.
        </p>
      )}
      <AddTile
        label={
          group === 'cash'
            ? 'Add a bank account, cash, or wallet'
            : group === 'investment'
              ? 'Add an investment'
              : 'Add a loan or card'
        }
        onClick={() => {
          open({ type: 'account', group });
        }}
      />
    </Section>
  );
}

function AccountCard({ summary, open }: { summary: AccountSummary; open: OpenFinanceDialog }) {
  const { account, value, invested, gain, gainRate, valued } = summary;
  const group = accountGroupOf(account.type);
  const details = [
    accountTypeLabel(account),
    account.institution,
    account.identifier ? `••${account.identifier}` : undefined,
    account.savingsPot ? SAVINGS_POT_LABELS[account.savingsPot] : undefined,
    account.archivedAt ? 'Archived' : undefined,
  ].filter(Boolean);

  return (
    <article
      className={`account-card${account.archivedAt ? ' account-card--archived' : ''}`}
      aria-labelledby={`account-${account.id}`}
    >
      <header className="account-card__header">
        {group === 'investment' && (
          <span
            className="chart-legend__key"
            style={{ background: investmentColor(account.type) }}
            aria-hidden="true"
          />
        )}
        <div className="account-card__titles">
          <h3 id={`account-${account.id}`} className="account-card__name">
            {account.name}
          </h3>
          <p className="account-card__meta">{details.join(' · ')}</p>
        </div>
        <p className={`account-card__value${value < 0 ? ' account-card__value--negative' : ''}`}>
          {formatINR(value)}
          {group === 'liability' && <span className="account-card__owed"> owed</span>}
        </p>
      </header>

      {group === 'investment' && (
        <dl className="account-card__numbers">
          <div>
            <dt>Invested</dt>
            <dd>{formatINR(invested ?? 0)}</dd>
          </div>
          <div>
            <dt>{(gain ?? 0) >= 0 ? 'Gain' : 'Loss'}</dt>
            <dd
              className={
                (gain ?? 0) < 0
                  ? 'account-card__loss'
                  : (gain ?? 0) > 0
                    ? 'account-card__gain'
                    : undefined
              }
            >
              {valued ? (
                <>
                  {formatINR(gain ?? 0, { signed: true })}
                  {gainRate != null && <span> {percent(gainRate)}</span>}
                </>
              ) : (
                'At cost'
              )}
            </dd>
          </div>
        </dl>
      )}

      <footer className="account-card__footer">
        <span className="account-card__asof">
          {group === 'investment'
            ? account.valuedOn
              ? `Valued ${shortDate(account.valuedOn)}`
              : 'No market value yet'
            : `From ${shortDate(account.asOf)} balance`}
        </span>
        <span className="account-card__actions">
          <Link
            to={`/investments/activity?account=${account.id}`}
            className="button button--secondary button--compact"
            aria-label={`Transactions for ${account.name}`}
          >
            History
          </Link>
          <button
            type="button"
            className="button button--secondary button--compact"
            aria-label={`Edit ${account.name}`}
            onClick={() => {
              open({ type: 'account', account });
            }}
          >
            Edit
          </button>
          <button
            type="button"
            className="button button--secondary button--compact"
            onClick={() => {
              open({ type: 'balance', account });
            }}
          >
            {group === 'investment' ? 'Update value' : 'Update balance'}
          </button>
          {!account.archivedAt && group === 'investment' && (
            <button
              type="button"
              className="button button--primary button--compact"
              onClick={() => {
                open({ type: 'entry', kind: 'investment', preset: { toAccountId: account.id } });
              }}
            >
              <Plus size={14} aria-hidden="true" /> Add money
            </button>
          )}
          {!account.archivedAt && group === 'liability' && value > 0 && (
            <button
              type="button"
              className="button button--primary button--compact"
              onClick={() => {
                open({
                  type: 'entry',
                  kind: 'transfer',
                  preset: {
                    toAccountId: account.id,
                    note: account.type === 'credit_card' ? 'Card bill payment' : 'Loan repayment',
                  },
                });
              }}
            >
              {account.type === 'credit_card' ? 'Pay bill' : 'Repay'}
            </button>
          )}
        </span>
      </footer>
    </article>
  );
}
