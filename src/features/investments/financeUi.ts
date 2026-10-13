import {
  ArrowLeftRight,
  CircleArrowDown,
  CircleArrowUp,
  HandCoins,
  PiggyBank,
  TrendingUp,
  type LucideIcon,
} from 'lucide-react';
import type { SelectOption } from '@/components/form';
import {
  ACCOUNT_GROUP_LABELS,
  ACCOUNT_TYPE_INFO,
  accountGroupOf,
  accountTypeLabel,
  ALL_EXPENSES,
  categoryLabel,
  categoryPath,
  EXPENSE_GROUPS,
  GROUP_PREFIX,
  INCOME_SOURCES,
  INCOME_SOURCE_LABELS,
  INVESTMENT_TYPES,
  SAVINGS_POTS,
  SAVINGS_POT_LABELS,
  type Account,
  type AccountGroup,
  type AccountType,
  type Budget,
  type EntryKind,
  type FinanceCategory,
  type FinanceEntry,
  type FinanceGoal,
  type GoalKind,
  type RecurringRule,
  type SalaryRecord,
} from '@/domain/finance';
import { formatDateKey } from '@/lib/dates';
import { formatINR } from '@/lib/money';

/** What the shared finance dialogs can be asked to open. */
export type FinanceDialogRequest =
  | { type: 'entry'; kind?: EntryKind; entry?: FinanceEntry; preset?: EntryPreset }
  | { type: 'account'; account?: Account; group?: AccountGroup }
  | { type: 'balance'; account: Account }
  | { type: 'goal'; goal?: FinanceGoal; kind?: GoalKind; year?: number }
  | { type: 'budget'; budget?: Budget; category?: string; period?: Budget['period'] }
  | { type: 'salary'; salary?: SalaryRecord }
  | { type: 'recurring'; rule?: RecurringRule; kind?: EntryKind; preset?: EntryPreset }
  | { type: 'record'; rule: RecurringRule };

export interface EntryPreset {
  amount?: number;
  category?: string;
  accountId?: string;
  toAccountId?: string;
  note?: string;
}

export type OpenFinanceDialog = (request: FinanceDialogRequest) => void;

export const KIND_ICONS: Record<EntryKind, LucideIcon> = {
  income: CircleArrowDown,
  expense: CircleArrowUp,
  investment: TrendingUp,
  saving: PiggyBank,
  transfer: ArrowLeftRight,
};

/** The icon for a debt repayment (a transfer into a loan or card). */
export const REPAYMENT_ICON = HandCoins;

/** Tile tones from tokens.css, one per kind. Always paired with an icon and a label. */
export const KIND_TONES: Record<EntryKind, string> = {
  income: 'sage',
  expense: 'coral',
  investment: 'ocean',
  saving: 'amber',
  transfer: 'slate',
};

/** User-facing names, plural, for filters and headings. */
export const KIND_PLURALS: Record<EntryKind, string> = {
  income: 'Income',
  expense: 'Expenses',
  investment: 'Investments',
  saving: 'Savings',
  transfer: 'Transfers',
};

/**
 * Categorical chart colors (CSS variables in tokens.css), validated for color-vision
 * deficiency in this order. Assign by a stable key, never by rank.
 */
export const SERIES = [1, 2, 3, 4, 5, 6, 7, 8].map((n) => `var(--series-${n})`);

/** One stable color per investment type, in type order; types past eight share "other". */
export function investmentColor(type: AccountType): string {
  const index = INVESTMENT_TYPES.indexOf(type);
  return SERIES[index] ?? 'var(--color-subtle)';
}

/** Account and category names for the rows of a list. */
export interface NameContext {
  accounts: readonly Account[];
  categories: readonly FinanceCategory[];
}

const accountName = (ctx: NameContext, id: string | undefined) =>
  id === undefined ? undefined : (ctx.accounts.find((a) => a.id === id)?.name ?? 'Removed account');

/** True for a transfer that pays down a loan or card from an everyday account. */
export function isDebtPayment(entry: FinanceEntry, accounts: readonly Account[]): boolean {
  if (entry.kind !== 'transfer' || entry.toAccountId === undefined) return false;
  const to = accounts.find((a) => a.id === entry.toAccountId);
  const from = accounts.find((a) => a.id === entry.accountId);
  return (
    to !== undefined &&
    accountGroupOf(to.type) === 'liability' &&
    (from === undefined || accountGroupOf(from.type) !== 'liability')
  );
}

/** What kind of movement this is, in words: "Expense", "Loan repayment", "Withdrawal"… */
export function entryKindLabel(entry: FinanceEntry, accounts: readonly Account[]): string {
  if (isDebtPayment(entry, accounts)) {
    const to = accounts.find((a) => a.id === entry.toAccountId);
    return to?.type === 'credit_card' ? 'Card payment' : 'Loan repayment';
  }
  if (entry.withdrawal) return entry.kind === 'investment' ? 'Redemption' : 'Savings withdrawal';
  return {
    income: 'Income',
    expense: 'Expense',
    investment: 'Investment',
    saving: 'Saving',
    transfer: 'Transfer',
  }[entry.kind];
}

/** Signed amount as it affects your everyday money: income in, everything else out. */
export function entryAmountText(entry: FinanceEntry): string {
  if (entry.kind === 'transfer') return formatINR(entry.amount);
  const incoming = entry.kind === 'income' || entry.withdrawal === true;
  return formatINR(incoming ? entry.amount : -entry.amount, { signed: true });
}

export function entryTitle(entry: FinanceEntry, ctx: NameContext): string {
  if (entry.note) return entry.note;
  if (entry.kind === 'transfer') {
    return `${accountName(ctx, entry.accountId) ?? '—'} → ${accountName(ctx, entry.toAccountId) ?? '—'}`;
  }
  const asset = entry.withdrawal ? entry.accountId : entry.toAccountId;
  if (entry.kind === 'investment' || entry.kind === 'saving') {
    return accountName(ctx, asset) ?? categoryLabel(entry.kind, entry.category, ctx.categories);
  }
  return categoryLabel(entry.kind, entry.category, ctx.categories);
}

/** "Food › Groceries · from Salary account", "Loan repayment · Salary account → Bike loan". */
export function entrySubtitle(entry: FinanceEntry, ctx: NameContext): string {
  const parts: string[] = [];
  if (entry.kind === 'transfer') {
    parts.push(entryKindLabel(entry, ctx.accounts));
    if (entry.note) {
      parts.push(
        `${accountName(ctx, entry.accountId) ?? '—'} → ${accountName(ctx, entry.toAccountId) ?? '—'}`,
      );
    }
    return parts.join(' · ');
  }
  parts.push(
    entry.withdrawal
      ? entryKindLabel(entry, ctx.accounts)
      : categoryPath(entry.kind, entry.category, ctx.categories),
  );
  const incoming = entry.kind === 'income' || entry.withdrawal === true;
  const via = accountName(ctx, incoming ? entry.toAccountId : entry.accountId);
  if (via) parts.push(incoming ? `to ${via}` : `from ${via}`);
  return parts.join(' · ');
}

/* ---------- Pickers ---------- */

/** Categories for one kind. Expenses are grouped, with custom subcategories in their group. */
export function categoryOptions(
  kind: EntryKind,
  categories: readonly FinanceCategory[],
): SelectOption[] {
  switch (kind) {
    case 'income':
      return [
        ...INCOME_SOURCES.map((s) => ({ value: s, label: INCOME_SOURCE_LABELS[s] })),
        ...categories
          .filter((c) => c.kind === 'income')
          .map((c) => ({ value: c.id, label: c.name, group: 'Your categories' })),
      ];
    case 'expense': {
      const custom = categories.filter((c) => c.kind === 'expense');
      const builtIn = EXPENSE_GROUPS.flatMap((g) => [
        ...g.subcategories.map(([value, label]) => ({ value, label, group: g.label })),
        ...custom
          .filter((c) => c.parent === g.key)
          .map((c) => ({ value: c.id, label: c.name, group: g.label })),
      ]);
      const customGroups = custom
        .filter((c) => c.parent === undefined)
        .flatMap((top) => [
          { value: top.id, label: top.name, group: top.name },
          ...custom
            .filter((c) => c.parent === top.id)
            .map((c) => ({ value: c.id, label: c.name, group: top.name })),
        ]);
      return [...builtIn, ...customGroups];
    }
    case 'investment':
      return INVESTMENT_TYPES.map((t) => ({ value: t, label: ACCOUNT_TYPE_INFO[t].label }));
    case 'saving':
      return SAVINGS_POTS.map((p) => ({ value: p, label: SAVINGS_POT_LABELS[p] }));
    case 'transfer':
      return [{ value: 'transfer', label: 'Transfer' }];
  }
}

/** Places a custom expense category can go: under a built-in or custom group, or on its own. */
export function parentOptions(categories: readonly FinanceCategory[]): SelectOption[] {
  return [
    ...EXPENSE_GROUPS.map((g) => ({ value: g.key, label: g.label })),
    ...categories
      .filter((c) => c.kind === 'expense' && c.parent === undefined)
      .map((c) => ({ value: c.id, label: c.name })),
    { value: '', label: 'A new group of its own' },
  ];
}

/** What a budget can cover: everything, a whole group, or one category. */
export function budgetCategoryOptions(categories: readonly FinanceCategory[]): SelectOption[] {
  const groups = [
    ...EXPENSE_GROUPS.map((g) => ({ key: g.key, label: g.label })),
    ...categories
      .filter((c) => c.kind === 'expense' && c.parent === undefined)
      .map((c) => ({ key: c.id, label: c.name })),
  ];
  return [
    { value: ALL_EXPENSES, label: 'All expenses' },
    ...groups.map((g) => ({
      value: `${GROUP_PREFIX}${g.key}`,
      label: `All of ${g.label}`,
      group: 'Whole groups',
    })),
    ...categoryOptions('expense', categories).filter((o) => !groups.some((g) => g.key === o.value)),
  ];
}

/**
 * Accounts in the allowed groups, grouped by kind. Archived accounts are left out unless one
 * is already chosen. The first option is "none" unless `required`.
 */
export function accountOptions(
  accounts: readonly Account[],
  allowed: readonly AccountGroup[],
  {
    selected,
    required = false,
    none = 'Not linked to an account',
  }: {
    selected?: string | undefined;
    required?: boolean;
    none?: string;
  } = {},
): SelectOption[] {
  const usable = accounts.filter(
    (a) => allowed.includes(accountGroupOf(a.type)) && (!a.archivedAt || a.id === selected),
  );
  return [
    ...(required ? [{ value: '', label: 'Choose an account' }] : [{ value: '', label: none }]),
    ...allowed.flatMap((group) =>
      usable
        .filter((a) => accountGroupOf(a.type) === group)
        .map((a) => ({
          value: a.id,
          label: `${a.name} · ${accountTypeLabel(a)}`,
          group: ACCOUNT_GROUP_LABELS[group],
        })),
    ),
  ];
}

const monthFormat = { month: 'long', year: 'numeric' } as const;
const shortMonthFormat = { month: 'short' } as const;

/** "October 2026" for a `YYYY-MM` month. */
export function monthName(month: string): string {
  return formatDateKey(`${month}-01`, undefined, monthFormat);
}

/** "Oct" for a `YYYY-MM` month. */
export function shortMonthName(month: string): string {
  return formatDateKey(`${month}-01`, undefined, shortMonthFormat);
}

/** "Oct 9, 2026" style date. */
export function shortDate(date: string): string {
  return formatDateKey(date, undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}
