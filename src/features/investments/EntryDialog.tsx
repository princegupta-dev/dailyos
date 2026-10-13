import { Repeat, ReceiptIndianRupee } from 'lucide-react';
import { useId, useState } from 'react';
import { ConfirmDialog, Dialog } from '@/components/Dialog';
import { SelectField, TextField } from '@/components/form';
import { SegmentedControl } from '@/components/SegmentedControl';
import {
  createFinanceCategory,
  createFinanceEntry,
  createRecurring,
  deleteFinanceEntry,
  deleteRecurring,
  updateFinanceEntry,
  updateRecurring,
} from '@/db/repositories/finance';
import {
  ENTRY_KINDS,
  entrySides,
  RECURRING_FREQUENCIES,
  RECURRING_FREQUENCY_LABELS,
  TRANSFER_CATEGORY,
  type AccountGroup,
  type EntryKind,
  type FinanceEntry,
  type RecurringFrequency,
  type RecurringRule,
} from '@/domain/finance';
import { useAction } from '@/hooks/useAction';
import { useSettings } from '@/hooks/useToday';
import { toRupeeInput } from '@/lib/money';
import type { FinanceData } from '@/services/finance.service';
import { accountOptions, categoryOptions, parentOptions, type EntryPreset } from './financeUi';
import { MoneyField } from './MoneyField';
import { readAmount, useFormSubmit } from './useFormSubmit';

/** Short labels so all five types fit side by side on a phone. */
const KIND_SHORT: Record<EntryKind, string> = {
  income: 'Income',
  expense: 'Expense',
  investment: 'Invest',
  saving: 'Savings',
  transfer: 'Transfer',
};
const KIND_OPTIONS = ENTRY_KINDS.map((k) => ({ value: k, label: KIND_SHORT[k] }));
const FREQUENCY_OPTIONS = RECURRING_FREQUENCIES.map((f) => ({
  value: f,
  label: RECURRING_FREQUENCY_LABELS[f],
}));
const NEW_CATEGORY = '__new__';
const EVERYDAY: readonly AccountGroup[] = ['cash', 'liability'];

const SUCCESS: Record<EntryKind, string> = {
  income: 'Income recorded',
  expense: 'Expense recorded',
  investment: 'Investment recorded',
  saving: 'Saving recorded',
  transfer: 'Transfer recorded',
};

const HINTS: Record<EntryKind, string> = {
  income: 'Money you earned.',
  expense: 'Money you spent.',
  investment: 'Money put into (or taken out of) an investment.',
  saving: 'Money set aside in savings (or taken back out).',
  transfer:
    'Money moved between your own accounts. Paying a loan or card? Choose it as “To”: it’s a repayment, not spending.',
};

function defaultCategory(kind: EntryKind): string {
  return {
    income: 'salary',
    expense: 'groceries',
    investment: 'mutual_fund',
    saving: 'general',
    transfer: TRANSFER_CATEGORY,
  }[kind];
}

interface EntryDialogProps {
  data: FinanceData;
  today: string;
  /** An existing transaction to edit. */
  entry?: FinanceEntry | undefined;
  /** Edit (or create, with `recurring`) a repeating payment instead of a single one. */
  rule?: RecurringRule | undefined;
  recurring?: boolean;
  kind?: EntryKind | undefined;
  preset?: EntryPreset | undefined;
  onClose: () => void;
}

/**
 * Add or edit a transaction of any kind, or a recurring payment: the same fields, plus a
 * schedule. Accounts are optional except for transfers, which move money between two.
 */
export function EntryDialog({
  data,
  today,
  entry,
  rule,
  recurring = rule !== undefined,
  kind: initialKind,
  preset,
  onClose,
}: EntryDialogProps) {
  const formId = useId();
  const { errors, setErrors, pending, submit } = useFormSubmit(onClose);
  const remove = useAction();
  const settings = useSettings();
  const [confirming, setConfirming] = useState(false);
  const source = entry ?? rule;
  const editing = source !== undefined;

  const startKind = source?.kind ?? initialKind ?? 'expense';
  const defaultAccount = editing ? undefined : settings?.defaultAccountId;
  const [kind, setKind] = useState<EntryKind>(startKind);
  const [amount, setAmount] = useState(
    source ? toRupeeInput(source.amount) : preset?.amount ? toRupeeInput(preset.amount) : '',
  );
  const [date, setDate] = useState(entry?.date ?? rule?.startDate ?? today);
  const [category, setCategory] = useState(
    source?.category ?? preset?.category ?? defaultCategory(startKind),
  );
  const [newCategory, setNewCategory] = useState('');
  const [newParent, setNewParent] = useState('other');
  const [withdrawal, setWithdrawal] = useState(source?.withdrawal ?? false);
  // `null` means untouched, so the default account applies; '' means "not linked".
  const [fromId, setFromId] = useState<string | null>(
    source ? (source.accountId ?? '') : (preset?.accountId ?? null),
  );
  const [toId, setToId] = useState<string | null>(
    source ? (source.toAccountId ?? '') : (preset?.toAccountId ?? null),
  );
  const [note, setNote] = useState(source?.note ?? preset?.note ?? '');
  const [repeat, setRepeat] = useState(recurring);
  const [frequency, setFrequency] = useState<RecurringFrequency>(rule?.frequency ?? 'monthly');
  const [endDate, setEndDate] = useState(rule?.endDate ?? '');
  const [autopay, setAutopay] = useState(rule?.autopay ?? false);

  // The default account fills the everyday side once settings have loaded.
  const everydayDefault = defaultAccount && data.accounts.some((a) => a.id === defaultAccount);
  const from =
    fromId ?? (everydayDefault && usesEverydayFrom(kind, withdrawal) ? defaultAccount : '');
  const to = toId ?? (everydayDefault && usesEverydayTo(kind, withdrawal) ? defaultAccount : '');

  const changeKind = (next: EntryKind) => {
    setKind(next);
    setCategory(defaultCategory(next));
    setFromId(null);
    setToId(null);
    setWithdrawal(false);
    setErrors({});
  };

  const sides = entrySides({
    accountId: from || undefined,
    toAccountId: to || undefined,
    withdrawal,
  });
  const assetAccount = data.accounts.find((a) => a.id === sides.asset);
  // An investment account decides the type; a savings account with a pot decides the pot.
  const categoryFromAccount =
    (kind === 'investment' && assetAccount !== undefined) ||
    (kind === 'saving' && assetAccount?.savingsPot !== undefined);
  const options = [
    ...categoryOptions(kind, data.categories),
    ...(kind === 'income' || kind === 'expense'
      ? [{ value: NEW_CATEGORY, label: 'New category…' }]
      : []),
  ];

  const save = async () => {
    const paise = readAmount(amount, 'amount');
    let finalCategory = category;
    if (category === NEW_CATEGORY && (kind === 'income' || kind === 'expense')) {
      finalCategory = (
        await createFinanceCategory({
          kind,
          name: newCategory,
          parent: kind === 'expense' && newParent !== '' ? newParent : undefined,
        })
      ).id;
      setCategory(finalCategory);
    }
    const draft = {
      kind,
      amount: paise,
      date,
      // For investments and savings with an account, the account decides (see checkAccounts).
      category: finalCategory,
      accountId: from || undefined,
      toAccountId: to || undefined,
      withdrawal,
      note,
    };
    if (repeat) {
      const schedule = {
        entry: draft,
        frequency,
        endDate: endDate || undefined,
        autopay,
      };
      if (rule) await updateRecurring(rule.id, schedule);
      else await createRecurring(schedule, { recordFirst: !recurring });
      return;
    }
    if (entry) await updateFinanceEntry(entry.id, draft);
    else await createFinanceEntry(draft);
  };

  const successMessage = rule
    ? 'Recurring payment updated'
    : repeat
      ? recurring
        ? 'Recurring payment added'
        : `${SUCCESS[kind]} and set to repeat`
      : entry
        ? 'Transaction updated'
        : SUCCESS[kind];

  const assetGroups: readonly AccountGroup[] = kind === 'investment' ? ['investment'] : ['cash'];
  const accountFields = (() => {
    const field = (
      label: string,
      value: string,
      set: (v: string | null) => void,
      groups: readonly AccountGroup[],
      path: string,
      required = false,
    ) => (
      <SelectField
        key={path}
        label={label}
        value={value}
        error={errors[path]}
        options={accountOptions(data.accounts, groups, { selected: value, required })}
        onChange={(e) => {
          set(e.target.value);
        }}
      />
    );
    switch (kind) {
      case 'income':
        return field('Received into', to, setToId, ['cash'], 'toAccountId');
      case 'expense':
        return field('Paid from', from, setFromId, EVERYDAY, 'accountId');
      case 'transfer':
        return (
          <div className="form__row">
            {field('From', from, setFromId, EVERYDAY, 'accountId', true)}
            {field('To', to, setToId, EVERYDAY, 'toAccountId', true)}
          </div>
        );
      case 'investment':
      case 'saving': {
        const assetLabel = kind === 'investment' ? 'Investment' : 'Savings account';
        return withdrawal ? (
          <div className="form__row">
            {field(assetLabel, from, setFromId, assetGroups, 'accountId')}
            {field('Received into', to, setToId, EVERYDAY, 'toAccountId')}
          </div>
        ) : (
          <div className="form__row">
            {field(assetLabel, to, setToId, assetGroups, 'toAccountId')}
            {field('Paid from', from, setFromId, EVERYDAY, 'accountId')}
          </div>
        );
      }
    }
  })();

  const title = rule
    ? 'Edit recurring payment'
    : recurring
      ? 'New recurring payment'
      : entry
        ? 'Edit transaction'
        : 'Add transaction';

  return (
    <>
      <Dialog
        open
        title={title}
        description={HINTS[kind]}
        icon={recurring ? Repeat : ReceiptIndianRupee}
        onClose={onClose}
        footer={
          <div className="finance-dialog__footer">
            {editing && (
              <button
                type="button"
                className="button button--secondary finance-dialog__delete"
                onClick={() => {
                  setConfirming(true);
                }}
              >
                Delete
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
        <div className="finance-kinds">
          <SegmentedControl
            label="Type"
            value={kind}
            options={KIND_OPTIONS}
            onChange={changeKind}
          />
        </div>
        <form
          id={formId}
          className="form finance-form"
          noValidate
          onSubmit={(e) => void submit(e, save, successMessage)}
        >
          <div className="form__row">
            <MoneyField label="Amount" value={amount} onChange={setAmount} error={errors.amount} />
            <TextField
              label={recurring ? (rule ? 'Schedule starts' : 'First payment') : 'Date'}
              type="date"
              value={date}
              max={repeat && recurring ? undefined : today}
              error={errors.date}
              hint={
                rule && date !== rule.startDate ? 'Changing it restarts the schedule.' : undefined
              }
              onChange={(e) => {
                setDate(e.target.value);
              }}
            />
          </div>

          {accountFields}

          {kind !== 'transfer' && !categoryFromAccount && (
            <SelectField
              label={
                kind === 'investment'
                  ? 'Investment type'
                  : kind === 'saving'
                    ? 'Savings pot'
                    : 'Category'
              }
              value={category}
              error={category === NEW_CATEGORY ? undefined : errors.category}
              options={options}
              onChange={(e) => {
                setCategory(e.target.value);
              }}
            />
          )}

          {category === NEW_CATEGORY && (
            <div className="form__row">
              <TextField
                label="New category name"
                value={newCategory}
                maxLength={40}
                autoComplete="off"
                error={errors.name ?? errors.category}
                onChange={(e) => {
                  setNewCategory(e.target.value);
                }}
              />
              {kind === 'expense' && (
                <SelectField
                  label="Group"
                  value={newParent}
                  error={errors.parent}
                  options={parentOptions(data.categories)}
                  onChange={(e) => {
                    setNewParent(e.target.value);
                  }}
                />
              )}
            </div>
          )}

          {(kind === 'investment' || kind === 'saving') && (
            <label className="checkbox-field">
              <input
                type="checkbox"
                className="checkbox"
                checked={withdrawal}
                onChange={(e) => {
                  // The accounts swap sides, so keep them where they were.
                  setFromId(to);
                  setToId(from);
                  setWithdrawal(e.target.checked);
                }}
              />
              {kind === 'investment'
                ? 'This is a withdrawal or redemption'
                : 'This is a withdrawal'}
            </label>
          )}

          <TextField
            label="Note"
            hint="Optional"
            value={note}
            maxLength={200}
            autoComplete="off"
            placeholder={kind === 'expense' ? 'e.g. Weekly groceries' : 'Optional details'}
            error={errors.note}
            onChange={(e) => {
              setNote(e.target.value);
            }}
          />

          {!entry && !recurring && (
            <label className="checkbox-field">
              <input
                type="checkbox"
                className="checkbox"
                checked={repeat}
                onChange={(e) => {
                  setRepeat(e.target.checked);
                }}
              />
              Repeat this payment
            </label>
          )}

          {repeat && (
            <fieldset className="fieldset finance-schedule">
              <legend className="field__label">Schedule</legend>
              <div className="form__row">
                <SelectField
                  label="Repeats"
                  value={frequency}
                  options={FREQUENCY_OPTIONS}
                  onChange={(e) => {
                    setFrequency(e.target.value as RecurringFrequency);
                  }}
                />
                <TextField
                  label="Ends on"
                  hint="Optional"
                  type="date"
                  value={endDate}
                  min={date}
                  error={errors.endDate}
                  onChange={(e) => {
                    setEndDate(e.target.value);
                  }}
                />
              </div>
              <label className="checkbox-field">
                <input
                  type="checkbox"
                  className="checkbox"
                  checked={autopay}
                  onChange={(e) => {
                    setAutopay(e.target.checked);
                  }}
                />
                Paid automatically (autopay or standing instruction)
              </label>
            </fieldset>
          )}
        </form>
      </Dialog>

      {editing && (
        <ConfirmDialog
          open={confirming}
          title={rule ? 'Delete this recurring payment?' : 'Delete this transaction?'}
          message={
            rule
              ? 'Future payments stop. Payments already recorded stay as they are.'
              : 'It will be removed from every total, balance, budget, and goal. This can’t be undone.'
          }
          confirmLabel="Delete"
          destructive
          pending={remove.pending}
          onCancel={() => {
            setConfirming(false);
          }}
          onConfirm={() => {
            void remove
              .run(
                () => (rule ? deleteRecurring(rule.id) : deleteFinanceEntry(entry?.id ?? '')),
                rule ? 'Recurring payment deleted' : 'Transaction deleted',
              )
              .then((result) => {
                if (result.ok) onClose();
              });
          }}
        />
      )}
    </>
  );
}

/** Whether the default (everyday) account belongs on the "from" side for this kind. */
function usesEverydayFrom(kind: EntryKind, withdrawal: boolean): boolean {
  return kind === 'expense' || ((kind === 'investment' || kind === 'saving') && !withdrawal);
}

/** Whether the default (everyday) account belongs on the "to" side for this kind. */
function usesEverydayTo(kind: EntryKind, withdrawal: boolean): boolean {
  return kind === 'income' || ((kind === 'investment' || kind === 'saving') && withdrawal);
}
