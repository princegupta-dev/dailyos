import { BellRing, CircleCheckBig, Goal, Plus, TriangleAlert, type LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import {
  categoryLabel,
  GOAL_KIND_LABELS,
  RECURRING_FREQUENCY_LABELS,
  type FinanceEntry,
  type RecurringRule,
} from '@/domain/finance';
import { inlineDayLabel } from '@/lib/format';
import { formatINR } from '@/lib/money';
import type {
  BudgetStatus,
  FinanceData,
  GoalProgress,
  GoalState,
} from '@/services/finance.service';
import { percent, plural } from '../reviews/format';
import { Meter, type MeterTone } from './FinanceCharts';
import {
  entryAmountText,
  entryKindLabel,
  entrySubtitle,
  entryTitle,
  isDebtPayment,
  KIND_ICONS,
  KIND_TONES,
  REPAYMENT_ICON,
  shortDate,
  type OpenFinanceDialog,
} from './financeUi';

/* ---------- Key numbers ---------- */

interface MoneyKpiProps {
  icon: LucideIcon;
  label: string;
  value: string;
  foot?: ReactNode;
  /** Draws attention to a negative or over-limit number (always with words in `foot`). */
  alert?: boolean;
}

/** One key number in the Insights KPI style. */
export function MoneyKpi({ icon: Icon, label, value, foot, alert = false }: MoneyKpiProps) {
  return (
    <div className={`kpi money-kpi${alert ? ' money-kpi--alert' : ''}`}>
      <dt className="kpi__label">
        <span className="kpi__icon" aria-hidden="true">
          <Icon size={14} />
        </span>
        {label}
      </dt>
      <dd className="kpi__value money-kpi__value">{value}</dd>
      {foot !== undefined && <dd className="money-kpi__foot">{foot}</dd>}
    </div>
  );
}

/* ---------- Quick actions ---------- */

const QUICK_ACTIONS = [
  { key: 'income', label: 'Income' },
  { key: 'expense', label: 'Expense' },
  { key: 'investment', label: 'Invest' },
  { key: 'saving', label: 'Savings' },
] as const;

/** One-tap ways to record money and set goals, shared by Today and Investments. */
export function QuickActions({ open, year }: { open: OpenFinanceDialog; year: number }) {
  return (
    <div className="quick-money" role="group" aria-label="Quick add">
      {QUICK_ACTIONS.map(({ key, label }) => {
        const Icon = KIND_ICONS[key];
        return (
          <button
            key={key}
            type="button"
            className="quick-money__button"
            onClick={() => {
              open({ type: 'entry', kind: key });
            }}
          >
            <span className={`quick-money__icon tone--${KIND_TONES[key]}`} aria-hidden="true">
              <Icon size={18} />
            </span>
            <span>
              <span className="visually-hidden">Add </span>
              {label}
            </span>
          </button>
        );
      })}
      <button
        type="button"
        className="quick-money__button"
        onClick={() => {
          open({ type: 'goal', year });
        }}
      >
        <span className="quick-money__icon tone--violet" aria-hidden="true">
          <Goal size={18} />
        </span>
        <span>
          <span className="visually-hidden">Add </span>Goal
        </span>
      </button>
    </div>
  );
}

/* ---------- Transactions ---------- */

interface EntryListProps {
  entries: readonly FinanceEntry[];
  data: Pick<FinanceData, 'categories' | 'accounts'>;
  open: OpenFinanceDialog;
  /** Show a date heading before each day's entries. */
  groupByDate?: boolean;
}

export function EntryList({ entries, data, open, groupByDate = false }: EntryListProps) {
  return (
    <ul className="entry-list">
      {entries.map((entry, i) => {
        const showDate = groupByDate && entries[i - 1]?.date !== entry.date;
        return (
          <li key={entry.id} className="entry-list__item">
            {showDate && <p className="entry-list__date">{shortDate(entry.date)}</p>}
            <EntryRow entry={entry} data={data} open={open} showDate={!groupByDate} />
          </li>
        );
      })}
    </ul>
  );
}

interface EntryRowProps {
  entry: FinanceEntry;
  data: Pick<FinanceData, 'categories' | 'accounts'>;
  open: OpenFinanceDialog;
  showDate: boolean;
}

function EntryRow({ entry, data, open, showDate }: EntryRowProps) {
  const repayment = isDebtPayment(entry, data.accounts);
  const Icon = repayment ? REPAYMENT_ICON : KIND_ICONS[entry.kind];
  const title = entryTitle(entry, data);
  const incoming = entry.kind === 'income' || entry.withdrawal === true;
  return (
    <button
      type="button"
      className="entry-row"
      aria-label={`${title}, ${entryKindLabel(entry, data.accounts)}, ${categoryLabel(entry.kind, entry.category, data.categories)}, ${shortDate(entry.date)}, ${entryAmountText(entry)}. Edit`}
      onClick={() => {
        open({ type: 'entry', entry });
      }}
    >
      <span
        className={`entry-row__icon tone--${repayment ? 'indigo' : KIND_TONES[entry.kind]}`}
        aria-hidden="true"
      >
        <Icon size={18} />
      </span>
      <span className="entry-row__body" aria-hidden="true">
        <span className="entry-row__title">{title}</span>
        <span className="entry-row__meta">
          {entrySubtitle(entry, data)}
          {showDate && ` · ${shortDate(entry.date)}`}
        </span>
      </span>
      <span
        className={`entry-row__amount${incoming ? ' entry-row__amount--in' : ''}${entry.kind === 'transfer' ? ' entry-row__amount--neutral' : ''}`}
        aria-hidden="true"
      >
        {entryAmountText(entry)}
      </span>
    </button>
  );
}

/* ---------- Recurring payments ---------- */

interface RecurringListProps {
  rules: readonly RecurringRule[];
  data: Pick<FinanceData, 'categories' | 'accounts'>;
  today: string;
  open: OpenFinanceDialog;
}

/**
 * Payments due now (with a one-tap Record) or coming up. Due ones open the record dialog;
 * upcoming ones open the schedule.
 */
export function RecurringList({ rules, data, today, open }: RecurringListProps) {
  return (
    <ul className="recurring-list">
      {rules.map((rule) => {
        const due = rule.endedAt === undefined && rule.nextDue <= today;
        const Icon = KIND_ICONS[rule.kind];
        const name = rule.note ?? categoryLabel(rule.kind, rule.category, data.categories);
        const when = rule.endedAt ? 'Ended' : `Due ${inlineDayLabel(rule.nextDue, today)}`;
        return (
          <li key={rule.id} className={`recurring-row${due ? ' recurring-row--due' : ''}`}>
            <span className={`entry-row__icon tone--${KIND_TONES[rule.kind]}`} aria-hidden="true">
              <Icon size={18} />
            </span>
            <button
              type="button"
              className="recurring-row__body"
              aria-label={`${name}, ${formatINR(rule.amount)}, ${RECURRING_FREQUENCY_LABELS[rule.frequency].toLowerCase()}, ${when}. Edit schedule`}
              onClick={() => {
                open({ type: 'recurring', rule });
              }}
            >
              <span className="entry-row__title" aria-hidden="true">
                {name}
              </span>
              <span className="entry-row__meta" aria-hidden="true">
                {formatINR(rule.amount)} ·{' '}
                {RECURRING_FREQUENCY_LABELS[rule.frequency].toLowerCase()}
                {rule.autopay && ' · autopay'}
              </span>
            </button>
            <span className={`recurring-row__when${due ? ' recurring-row__when--due' : ''}`}>
              {due && <BellRing size={14} aria-hidden="true" />}
              {when}
            </span>
            {due && (
              <button
                type="button"
                className="button button--primary button--compact"
                aria-label={`Record ${name}`}
                onClick={() => {
                  open({ type: 'record', rule });
                }}
              >
                Record
              </button>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/* ---------- Goals ---------- */

const GOAL_STATE_TEXT: Record<GoalState, string> = {
  done: 'Reached',
  on_track: 'On track',
  behind: 'Behind pace',
  within: 'Within limit',
  over: 'Over the limit',
};

const GOAL_STATE_TONE: Record<GoalState, MeterTone> = {
  done: 'done',
  on_track: 'ok',
  behind: 'near',
  within: 'ok',
  over: 'over',
};

export function GoalItem({ progress, open }: { progress: GoalProgress; open?: OpenFinanceDialog }) {
  const { goal, current, remaining, fraction, elapsed, state, monthsLeft, perMonth } = progress;
  const spending = goal.kind === 'spending';
  const StateIcon =
    state === 'done' || state === 'on_track' || state === 'within' ? CircleCheckBig : TriangleAlert;
  const detail = spending
    ? state === 'over'
      ? `${formatINR(current - goal.target)} over the limit`
      : `${formatINR(remaining)} left to spend${perMonth !== null ? ` · about ${formatINR(perMonth)}/month` : ''}`
    : state === 'done'
      ? 'Goal reached'
      : `${formatINR(remaining)} to go${perMonth !== null ? ` · ${formatINR(perMonth)}/month for ${plural(monthsLeft, 'month')}` : ' · deadline passed'}`;

  const body = (
    <>
      <span className="goal-item__top">
        <span className="goal-item__name">{goal.name}</span>
        <span className={`goal-item__state goal-item__state--${state}`}>
          <StateIcon size={14} aria-hidden="true" />
          {GOAL_STATE_TEXT[state]}
        </span>
      </span>
      <span className="goal-item__numbers">
        <strong>{formatINR(current)}</strong>
        <span>
          {' '}
          of {formatINR(goal.target)} · {GOAL_KIND_LABELS[goal.kind].toLowerCase()} by{' '}
          {shortDate(goal.deadline)}
        </span>
      </span>
      <Meter
        fraction={fraction}
        tone={GOAL_STATE_TONE[state]}
        marker={elapsed}
        label={`${percent(fraction)} of ${formatINR(goal.target)}; ${percent(elapsed)} of the time has passed`}
      />
      <span className="goal-item__detail">{detail}</span>
    </>
  );

  if (!open) return <div className="goal-item">{body}</div>;
  return (
    <button
      type="button"
      className="goal-item goal-item--button"
      onClick={() => {
        open({ type: 'goal', goal });
      }}
    >
      {body}
    </button>
  );
}

/* ---------- Budgets ---------- */

const BUDGET_TONE: Record<BudgetStatus['state'], MeterTone> = {
  ok: 'ok',
  near: 'near',
  over: 'over',
};

interface BudgetItemProps {
  status: BudgetStatus;
  label: string;
  open?: OpenFinanceDialog | undefined;
}

export function BudgetItem({ status, label, open }: BudgetItemProps) {
  const { budget, spent, remaining, utilization, state } = status;
  const body = (
    <>
      <span className="budget-item__top">
        <span className="budget-item__name">{label}</span>
        <span className="budget-item__numbers">
          {formatINR(spent)} <span>of {formatINR(budget.limit)}</span>
        </span>
      </span>
      <Meter
        fraction={utilization}
        tone={BUDGET_TONE[state]}
        label={`${label}: ${percent(utilization)} of the budget used`}
      />
      <span className={`budget-item__detail budget-item__detail--${state}`}>
        {state === 'over' ? (
          <>
            <TriangleAlert size={14} aria-hidden="true" /> {formatINR(-remaining)} over budget
          </>
        ) : (
          <>
            {formatINR(remaining)} left · {percent(utilization)} used
            {state === 'near' && ' · nearly there'}
          </>
        )}
      </span>
    </>
  );
  if (!open) return <div className="budget-item">{body}</div>;
  return (
    <button
      type="button"
      className="budget-item budget-item--button"
      onClick={() => {
        open({ type: 'budget', budget });
      }}
    >
      {body}
    </button>
  );
}

/** A dashed "add" tile used at the end of lists. */
export function AddTile({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" className="add-tile" onClick={onClick}>
      <Plus size={16} aria-hidden="true" />
      {label}
    </button>
  );
}
