import { ChartPie, CircleCheckBig, Goal, Landmark, LineChart, Repeat, Wallet } from 'lucide-react';
import { useId, useState } from 'react';
import { ConfirmDialog, Dialog } from '@/components/Dialog';
import { SelectField, TextField } from '@/components/form';
import { SegmentedControl } from '@/components/SegmentedControl';
import {
  createAccount,
  createFinanceGoal,
  createSalaryRecord,
  deleteAccount,
  deleteBudget,
  deleteFinanceGoal,
  deleteSalaryRecord,
  recordRecurring,
  saveBudget,
  setAccountArchived,
  setAccountBalance,
  skipRecurring,
  updateAccount,
  updateFinanceGoal,
  updateSalaryRecord,
} from '@/db/repositories/finance';
import {
  ACCOUNT_GROUP_LABELS,
  ACCOUNT_GROUPS,
  ACCOUNT_TYPE_INFO,
  ACCOUNT_TYPES,
  accountGroupOf,
  ALL_EXPENSES,
  BUDGET_PERIODS,
  categoryLabel,
  GOAL_KINDS,
  GOAL_KIND_HINTS,
  GOAL_KIND_LABELS,
  RECURRING_FREQUENCY_LABELS,
  SAVINGS_POT_LABELS,
  SAVINGS_POTS,
  type Account,
  type AccountGroup,
  type AccountType,
  type Budget,
  type BudgetPeriod,
  type FinanceGoal,
  type GoalKind,
  type RecurringRule,
  type SalaryRecord,
  type SavingsPot,
} from '@/domain/finance';
import { useAction } from '@/hooks/useAction';
import { formatINR, toRupeeInput } from '@/lib/money';
import { accountSummaries, type FinanceData } from '@/services/finance.service';
import { budgetCategoryOptions, shortDate } from './financeUi';
import { MoneyField } from './MoneyField';
import { readAmount, readBalance, readOptionalAmount, useFormSubmit } from './useFormSubmit';

/* ---------- Shared pieces ---------- */

interface ActionsProps {
  formId: string;
  pending: boolean;
  onCancel: () => void;
  onDelete?: (() => void) | undefined;
  saveLabel?: string;
}

function DialogActions({ formId, pending, onCancel, onDelete, saveLabel = 'Save' }: ActionsProps) {
  return (
    <div className="finance-dialog__footer">
      {onDelete && (
        <button
          type="button"
          className="button button--secondary finance-dialog__delete"
          onClick={onDelete}
        >
          Delete
        </button>
      )}
      <button type="button" className="button button--secondary" onClick={onCancel}>
        Cancel
      </button>
      <button type="submit" form={formId} className="button button--primary" disabled={pending}>
        {saveLabel}
      </button>
    </div>
  );
}

interface DeleteConfirmProps {
  open: boolean;
  title: string;
  message: string;
  success: string;
  operation: () => Promise<void>;
  onCancel: () => void;
  onDone: () => void;
}

function DeleteConfirm({
  open,
  title,
  message,
  success,
  operation,
  onCancel,
  onDone,
}: DeleteConfirmProps) {
  const { run, pending } = useAction();
  return (
    <ConfirmDialog
      open={open}
      title={title}
      message={message}
      confirmLabel="Delete"
      destructive
      pending={pending}
      onCancel={onCancel}
      onConfirm={() => {
        void run(operation, success).then((result) => {
          if (result.ok) onDone();
        });
      }}
    />
  );
}

/* ---------- Accounts & assets ---------- */

const TYPE_OPTIONS = ACCOUNT_GROUPS.flatMap((group) =>
  ACCOUNT_TYPES.filter((t) => ACCOUNT_TYPE_INFO[t].group === group).map((t) => ({
    value: t,
    label: ACCOUNT_TYPE_INFO[t].label,
    group: ACCOUNT_GROUP_LABELS[group],
  })),
);

const POT_OPTIONS = [
  { value: '', label: 'No, everyday money' },
  ...SAVINGS_POTS.map((p) => ({ value: p, label: `Yes, ${SAVINGS_POT_LABELS[p].toLowerCase()}` })),
];

const DEFAULT_TYPE: Record<AccountGroup, AccountType> = {
  cash: 'bank_savings',
  investment: 'mutual_fund',
  liability: 'loan',
};

const BALANCE_LABEL: Record<AccountGroup, string> = {
  cash: 'Current balance',
  investment: 'Current value',
  liability: 'Amount owed',
};

interface AccountDialogProps {
  data: FinanceData;
  today: string;
  account?: Account | undefined;
  group?: AccountGroup | undefined;
  onClose: () => void;
}

/**
 * Add or edit a bank account, cash, wallet, investment, loan, or card. The balance is what it
 * holds on the chosen date; transactions after that keep it current.
 */
export function AccountDialog({ data, today, account, group, onClose }: AccountDialogProps) {
  const formId = useId();
  const { errors, pending, submit } = useFormSubmit(onClose);
  const [confirming, setConfirming] = useState(false);
  const archive = useAction();
  const summary = account ? accountSummaries([account], data.entries, today)[0] : undefined;
  const [type, setType] = useState<AccountType>(account?.type ?? DEFAULT_TYPE[group ?? 'cash']);
  const [name, setName] = useState(account?.name ?? '');
  const [customType, setCustomType] = useState(account?.customType ?? '');
  const [institution, setInstitution] = useState(account?.institution ?? '');
  const [identifier, setIdentifier] = useState(account?.identifier ?? '');
  const [openedOn, setOpenedOn] = useState(account?.openedOn ?? '');
  const [balance, setBalance] = useState(account ? toRupeeInput(account.balance) : '');
  const [asOf, setAsOf] = useState(account?.asOf ?? today);
  const [invested, setInvested] = useState(
    account?.invested === undefined ? '' : toRupeeInput(account.invested),
  );
  const [pot, setPot] = useState<SavingsPot | ''>(account?.savingsPot ?? '');
  const [note, setNote] = useState(account?.note ?? '');
  const kind = accountGroupOf(type);
  const used =
    account !== undefined &&
    (data.entries.some((e) => e.accountId === account.id || e.toAccountId === account.id) ||
      data.recurring.some((r) => r.accountId === account.id || r.toAccountId === account.id));

  const save = async () => {
    const draft = {
      name,
      type,
      customType,
      institution,
      identifier,
      openedOn: openedOn || undefined,
      note,
      balance: readBalance(balance, 'balance', kind === 'cash'),
      asOf,
      invested: kind === 'investment' ? readOptionalAmount(invested, 'invested') : undefined,
      savingsPot: kind === 'cash' && pot !== '' ? pot : undefined,
    };
    if (account) await updateAccount(account.id, draft);
    else await createAccount(draft);
  };

  return (
    <>
      <Dialog
        open
        title={account ? 'Edit account' : 'Add an account or asset'}
        description="Bank, cash, wallet, investment, loan, or card."
        icon={Landmark}
        onClose={onClose}
        footer={
          <div className="finance-dialog__footer">
            {account && (
              <button
                type="button"
                className="button button--secondary finance-dialog__delete"
                disabled={archive.pending}
                onClick={() => {
                  if (used) {
                    void archive
                      .run(
                        () => setAccountArchived(account.id, account.archivedAt === undefined),
                        account.archivedAt ? 'Account restored' : 'Account archived',
                      )
                      .then((r) => {
                        if (r.ok) onClose();
                      });
                  } else setConfirming(true);
                }}
              >
                {used ? (account.archivedAt ? 'Restore' : 'Archive') : 'Delete'}
              </button>
            )}
            <button type="button" className="button button--secondary" onClick={onClose}>
              Cancel
            </button>
            <button
              type="submit"
              form={formId}
              className="button button--primary"
              disabled={pending}
            >
              Save
            </button>
          </div>
        }
      >
        <form
          id={formId}
          className="form finance-form"
          noValidate
          onSubmit={(e) => void submit(e, save, account ? 'Account updated' : 'Account added')}
        >
          <div className="form__row">
            <SelectField
              label="Type"
              value={type}
              options={TYPE_OPTIONS}
              error={errors.type}
              onChange={(e) => {
                setType(e.target.value as AccountType);
              }}
            />
            <TextField
              label="Name"
              value={name}
              maxLength={80}
              autoComplete="off"
              placeholder={
                kind === 'cash'
                  ? 'e.g. Salary account'
                  : kind === 'investment'
                    ? 'e.g. Nifty 50 index fund'
                    : 'e.g. Home loan'
              }
              error={errors.name}
              onChange={(e) => {
                setName(e.target.value);
              }}
            />
          </div>
          {type.startsWith('other_') && (
            <TextField
              label="What kind of account is it?"
              hint="Optional, e.g. Chit fund, Crypto, Personal loan"
              value={customType}
              maxLength={40}
              autoComplete="off"
              error={errors.customType}
              onChange={(e) => {
                setCustomType(e.target.value);
              }}
            />
          )}
          <div className="form__row">
            <TextField
              label={kind === 'investment' ? 'Platform or institution' : 'Bank or institution'}
              hint="Optional"
              value={institution}
              maxLength={80}
              autoComplete="off"
              error={errors.institution}
              onChange={(e) => {
                setInstitution(e.target.value);
              }}
            />
            <TextField
              label="Reference"
              hint="Optional. Last 4 digits only, never the full number."
              value={identifier}
              maxLength={30}
              autoComplete="off"
              error={errors.identifier}
              onChange={(e) => {
                setIdentifier(e.target.value);
              }}
            />
          </div>
          <div className="form__row">
            <MoneyField
              label={BALANCE_LABEL[kind]}
              hint={kind === 'cash' ? 'Use a minus sign if overdrawn.' : undefined}
              value={balance}
              onChange={setBalance}
              error={errors.balance}
            />
            <TextField
              label="As of"
              type="date"
              value={asOf}
              max={today}
              error={errors.asOf}
              onChange={(e) => {
                setAsOf(e.target.value);
              }}
            />
          </div>
          {summary && account && summary.value !== account.balance && (
            <p className="field__hint">
              With transactions since {shortDate(account.asOf)}, it’s {formatINR(summary.value)}{' '}
              now. Changing the amount or date starts from the new figure.
            </p>
          )}
          {kind === 'investment' && (
            <MoneyField
              label="Amount invested so far"
              hint="Optional. Leave empty if it equals the current value."
              value={invested}
              onChange={setInvested}
              error={errors.invested}
            />
          )}
          {kind === 'cash' && (
            <SelectField
              label="Does it hold savings?"
              hint="Savings accounts count toward savings and the emergency fund."
              value={pot}
              options={POT_OPTIONS}
              onChange={(e) => {
                setPot(e.target.value as SavingsPot | '');
              }}
            />
          )}
          <div className="form__row">
            <TextField
              label="Opened on"
              hint="Optional"
              type="date"
              value={openedOn}
              max={today}
              error={errors.openedOn}
              onChange={(e) => {
                setOpenedOn(e.target.value);
              }}
            />
            <TextField
              label="Note"
              hint="Optional"
              value={note}
              maxLength={300}
              autoComplete="off"
              error={errors.note}
              onChange={(e) => {
                setNote(e.target.value);
              }}
            />
          </div>
        </form>
      </Dialog>
      {account && (
        <DeleteConfirm
          open={confirming}
          title={`Delete ${account.name}?`}
          message="It has no transactions, so nothing else changes."
          success="Account deleted"
          operation={() => deleteAccount(account.id)}
          onCancel={() => {
            setConfirming(false);
          }}
          onDone={onClose}
        />
      )}
    </>
  );
}

/** Quick update from a statement or app: today's balance, market value, or amount owed. */
export function BalanceDialog({
  data,
  today,
  account,
  onClose,
}: {
  data: FinanceData;
  today: string;
  account: Account;
  onClose: () => void;
}) {
  const formId = useId();
  const { errors, pending, submit } = useFormSubmit(onClose);
  const group = accountGroupOf(account.type);
  const summary = accountSummaries([account], data.entries, today)[0];
  const [value, setValue] = useState(summary ? toRupeeInput(summary.value) : '');
  const [asOf, setAsOf] = useState(today);
  const save = async () => {
    await setAccountBalance(account.id, readBalance(value, 'balance', group === 'cash'), asOf);
  };
  return (
    <Dialog
      open
      title={group === 'investment' ? 'Update value' : 'Update balance'}
      description={
        group === 'investment'
          ? `${account.name}. The difference from what you invested shows as gain or loss.`
          : `${account.name}. Transactions after this date keep it up to date.`
      }
      icon={LineChart}
      onClose={onClose}
      footer={<DialogActions formId={formId} pending={pending} onCancel={onClose} />}
    >
      <form
        id={formId}
        className="form finance-form"
        noValidate
        onSubmit={(e) =>
          void submit(e, save, group === 'investment' ? 'Value updated' : 'Balance updated')
        }
      >
        <div className="form__row">
          <MoneyField
            label={BALANCE_LABEL[group]}
            hint="From your statement, app, or broker."
            value={value}
            onChange={setValue}
            error={errors.balance}
          />
          <TextField
            label="As of"
            type="date"
            value={asOf}
            max={today}
            error={errors.asOf}
            onChange={(e) => {
              setAsOf(e.target.value);
            }}
          />
        </div>
      </form>
    </Dialog>
  );
}

/* ---------- Recurring: record a due payment ---------- */

/** Records the payment that's due, for its usual amount or this time's, or skips it. */
export function RecordDialog({
  data,
  rule,
  onClose,
}: {
  data: FinanceData;
  rule: RecurringRule;
  onClose: () => void;
}) {
  const formId = useId();
  const { errors, pending, submit } = useFormSubmit(onClose);
  const skip = useAction();
  const [amount, setAmount] = useState(toRupeeInput(rule.amount));
  const name = rule.note ?? categoryLabel(rule.kind, rule.category, data.categories);
  return (
    <Dialog
      open
      title="Record payment"
      description={`${name}, due ${shortDate(rule.nextDue)} · ${RECURRING_FREQUENCY_LABELS[rule.frequency].toLowerCase()}`}
      icon={Repeat}
      onClose={onClose}
      footer={
        <div className="finance-dialog__footer">
          <button
            type="button"
            className="button button--secondary finance-dialog__delete"
            disabled={skip.pending}
            onClick={() => {
              void skip
                .run(() => skipRecurring(rule.id), 'Payment skipped')
                .then((r) => {
                  if (r.ok) onClose();
                });
            }}
          >
            Skip this time
          </button>
          <button type="button" className="button button--secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" form={formId} className="button button--primary" disabled={pending}>
            <CircleCheckBig size={16} aria-hidden="true" /> Record
          </button>
        </div>
      }
    >
      <form
        id={formId}
        className="form finance-form"
        noValidate
        onSubmit={(e) =>
          void submit(
            e,
            () => recordRecurring(rule.id, readAmount(amount, 'amount')),
            'Payment recorded',
          )
        }
      >
        <MoneyField
          label="Amount"
          hint="Change it if this time was different, e.g. a variable bill."
          value={amount}
          onChange={setAmount}
          error={errors.amount}
        />
      </form>
    </Dialog>
  );
}

/* ---------- Goal ---------- */

const GOAL_OPTIONS = GOAL_KINDS.map((k) => ({ value: k, label: GOAL_KIND_LABELS[k] }));

interface GoalDialogProps {
  goal?: FinanceGoal | undefined;
  kind?: GoalKind | undefined;
  year: number;
  onClose: () => void;
}

export function GoalDialog({
  goal,
  kind: initialKind,
  year: initialYear,
  onClose,
}: GoalDialogProps) {
  const formId = useId();
  const { errors, pending, submit } = useFormSubmit(onClose);
  const [confirming, setConfirming] = useState(false);
  const [kind, setKind] = useState<GoalKind>(goal?.kind ?? initialKind ?? 'savings');
  const [name, setName] = useState(goal?.name ?? '');
  const [year, setYear] = useState(goal?.year ?? initialYear);
  const [target, setTarget] = useState(goal ? toRupeeInput(goal.target) : '');
  const [deadline, setDeadline] = useState(goal?.deadline ?? `${initialYear}-12-31`);

  const years = [initialYear - 1, initialYear, initialYear + 1, initialYear + 2];
  const save = async () => {
    const draft = { name, kind, year, target: readAmount(target, 'target'), deadline };
    if (goal) await updateFinanceGoal(goal.id, draft);
    else await createFinanceGoal(draft);
  };

  return (
    <>
      <Dialog
        open
        title={goal ? 'Edit goal' : 'New yearly goal'}
        description={GOAL_KIND_HINTS[kind]}
        icon={Goal}
        onClose={onClose}
        footer={
          <DialogActions
            formId={formId}
            pending={pending}
            onCancel={onClose}
            onDelete={
              goal
                ? () => {
                    setConfirming(true);
                  }
                : undefined
            }
          />
        }
      >
        <SegmentedControl
          label="Goal type"
          value={kind}
          options={GOAL_OPTIONS}
          onChange={setKind}
        />
        <form
          id={formId}
          className="form finance-form"
          noValidate
          onSubmit={(e) => void submit(e, save, goal ? 'Goal updated' : 'Goal created')}
        >
          <TextField
            label="Name"
            value={name}
            maxLength={80}
            autoComplete="off"
            placeholder={
              kind === 'savings'
                ? 'e.g. Build an emergency fund'
                : kind === 'investment'
                  ? 'e.g. Invest for retirement'
                  : 'e.g. Keep spending under control'
            }
            error={errors.name}
            onChange={(e) => {
              setName(e.target.value);
            }}
          />
          <div className="form__row">
            <MoneyField
              label={kind === 'spending' ? 'Spending limit' : 'Target'}
              value={target}
              onChange={setTarget}
              error={errors.target}
            />
            <SelectField
              label="Year"
              value={String(year)}
              options={years.map((y) => ({ value: String(y), label: String(y) }))}
              onChange={(e) => {
                const next = Number(e.target.value);
                setYear(next);
                setDeadline(`${next}${deadline.slice(4)}`);
              }}
            />
          </div>
          <TextField
            label="Deadline"
            type="date"
            value={deadline}
            min={`${year}-01-01`}
            max={`${year}-12-31`}
            error={errors.deadline}
            onChange={(e) => {
              setDeadline(e.target.value);
            }}
          />
        </form>
      </Dialog>
      {goal && (
        <DeleteConfirm
          open={confirming}
          title={`Delete “${goal.name}”?`}
          message="Only the goal is removed. Your transactions stay as they are."
          success="Goal deleted"
          operation={() => deleteFinanceGoal(goal.id)}
          onCancel={() => {
            setConfirming(false);
          }}
          onDone={onClose}
        />
      )}
    </>
  );
}

/* ---------- Budget ---------- */

const PERIOD_OPTIONS = BUDGET_PERIODS.map((p) => ({
  value: p,
  label: p === 'monthly' ? 'Monthly' : 'Annual',
}));

interface BudgetDialogProps {
  data: FinanceData;
  budget?: Budget | undefined;
  category?: string | undefined;
  period?: BudgetPeriod | undefined;
  onClose: () => void;
}

export function BudgetDialog({
  data,
  budget,
  category: initialCategory,
  period: initialPeriod,
  onClose,
}: BudgetDialogProps) {
  const formId = useId();
  const { errors, pending, submit } = useFormSubmit(onClose);
  const [confirming, setConfirming] = useState(false);
  const [period, setPeriod] = useState<BudgetPeriod>(budget?.period ?? initialPeriod ?? 'monthly');
  const [category, setCategory] = useState(budget?.category ?? initialCategory ?? ALL_EXPENSES);
  const [limit, setLimit] = useState(budget ? toRupeeInput(budget.limit) : '');

  const replaces = data.budgets.find(
    (b) => b.period === period && b.category === category && b.id !== budget?.id,
  );
  const save = async () => {
    await saveBudget({ period, category, limit: readAmount(limit, 'limit') }, budget?.id);
  };

  return (
    <>
      <Dialog
        open
        title={budget ? 'Edit budget' : 'Set a budget'}
        description="A spending limit that repeats every month or year."
        icon={ChartPie}
        onClose={onClose}
        footer={
          <DialogActions
            formId={formId}
            pending={pending}
            onCancel={onClose}
            onDelete={
              budget
                ? () => {
                    setConfirming(true);
                  }
                : undefined
            }
          />
        }
      >
        <SegmentedControl
          label="Period"
          value={period}
          options={PERIOD_OPTIONS}
          onChange={setPeriod}
        />
        <form
          id={formId}
          className="form finance-form"
          noValidate
          onSubmit={(e) => void submit(e, save, 'Budget saved')}
        >
          <SelectField
            label="Category"
            value={category}
            options={budgetCategoryOptions(data.categories)}
            error={errors.category}
            hint={
              replaces ? `Replaces the current limit of ${formatINR(replaces.limit)}.` : undefined
            }
            onChange={(e) => {
              setCategory(e.target.value);
            }}
          />
          <MoneyField
            label={period === 'monthly' ? 'Limit per month' : 'Limit per year'}
            value={limit}
            onChange={setLimit}
            error={errors.limit}
          />
        </form>
      </Dialog>
      {budget && (
        <DeleteConfirm
          open={confirming}
          title="Delete this budget?"
          message="Your transactions stay as they are."
          success="Budget deleted"
          operation={() => deleteBudget(budget.id)}
          onCancel={() => {
            setConfirming(false);
          }}
          onDone={onClose}
        />
      )}
    </>
  );
}

/* ---------- Salary ---------- */

interface SalaryDialogProps {
  salary?: SalaryRecord | undefined;
  today: string;
  onClose: () => void;
}

export function SalaryDialog({ salary, today, onClose }: SalaryDialogProps) {
  const formId = useId();
  const { errors, pending, submit } = useFormSubmit(onClose);
  const [confirming, setConfirming] = useState(false);
  const [effectiveFrom, setEffectiveFrom] = useState(
    salary?.effectiveFrom ?? `${today.slice(0, 7)}-01`,
  );
  const [gross, setGross] = useState(salary ? toRupeeInput(salary.monthlyGross) : '');
  const [inHand, setInHand] = useState(salary ? toRupeeInput(salary.monthlyInHand) : '');
  const [ctc, setCtc] = useState(
    salary?.annualCtc === undefined ? '' : toRupeeInput(salary.annualCtc),
  );
  const [employer, setEmployer] = useState(salary?.employer ?? '');
  const [note, setNote] = useState(salary?.note ?? '');

  const save = async () => {
    const monthlyGross = readAmount(gross, 'monthlyGross');
    const monthlyInHand = readAmount(inHand, 'monthlyInHand');
    const annualCtc = readOptionalAmount(ctc, 'annualCtc');
    const draft = {
      effectiveFrom,
      monthlyGross,
      monthlyInHand,
      annualCtc: annualCtc === 0 ? undefined : annualCtc,
      employer,
      note,
    };
    if (salary) await updateSalaryRecord(salary.id, draft);
    else await createSalaryRecord(draft);
  };

  return (
    <>
      <Dialog
        open
        title={salary ? 'Edit salary' : 'Add salary'}
        description="Add a new entry for each raise or job change to keep your history."
        icon={Wallet}
        onClose={onClose}
        footer={
          <DialogActions
            formId={formId}
            pending={pending}
            onCancel={onClose}
            onDelete={
              salary
                ? () => {
                    setConfirming(true);
                  }
                : undefined
            }
          />
        }
      >
        <form
          id={formId}
          className="form finance-form"
          noValidate
          onSubmit={(e) => void submit(e, save, salary ? 'Salary updated' : 'Salary saved')}
        >
          <div className="form__row">
            <MoneyField
              label="Monthly gross"
              value={gross}
              onChange={setGross}
              error={errors.monthlyGross}
            />
            <MoneyField
              label="Monthly in-hand"
              hint="After tax and deductions"
              value={inHand}
              onChange={setInHand}
              error={errors.monthlyInHand}
            />
          </div>
          <div className="form__row">
            <MoneyField
              label="Annual CTC"
              hint="Optional"
              value={ctc}
              onChange={setCtc}
              error={errors.annualCtc}
            />
            <TextField
              label="Starts from"
              type="date"
              value={effectiveFrom}
              error={errors.effectiveFrom}
              onChange={(e) => {
                setEffectiveFrom(e.target.value);
              }}
            />
          </div>
          <TextField
            label="Employer"
            hint="Optional"
            value={employer}
            maxLength={80}
            autoComplete="organization"
            error={errors.employer}
            onChange={(e) => {
              setEmployer(e.target.value);
            }}
          />
          <TextField
            label="Note"
            hint="Optional, e.g. Annual appraisal"
            value={note}
            maxLength={200}
            autoComplete="off"
            error={errors.note}
            onChange={(e) => {
              setNote(e.target.value);
            }}
          />
        </form>
      </Dialog>
      {salary && (
        <DeleteConfirm
          open={confirming}
          title="Delete this salary entry?"
          message="It’s removed from your salary history. Income you recorded stays as it is."
          success="Salary deleted"
          operation={() => deleteSalaryRecord(salary.id)}
          onCancel={() => {
            setConfirming(false);
          }}
          onDone={onClose}
        />
      )}
    </>
  );
}
