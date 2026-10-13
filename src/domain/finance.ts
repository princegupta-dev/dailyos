import { z } from 'zod';
import { MAX_PAISE } from '@/lib/money';
import { dateKeySchema, idSchema, optionalText, timestampSchema } from '@/lib/validation';

/*
 * Personal finance. Every money movement is one FinanceEntry with a `kind`, and the kinds
 * never overlap, so nothing is counted twice:
 *
 * - income      money earned (salary, freelance, interest…), received into an account
 * - expense     money spent and gone, paid from an account (or card)
 * - investment  money moved into an investment (mutual fund, SIP, FD, gold, stocks…); a
 *               withdrawal moves it back out
 * - saving      money set aside in savings (general or emergency fund); a withdrawal takes
 *               it back
 * - transfer    money moved between your own accounts. Neither earned nor spent, so it is
 *               left out of income and expenses. A transfer into a loan or credit card is a
 *               debt repayment: it lowers what you owe, and is never counted as spending.
 *
 * Every entry may name the account the money left (`accountId`) and the account it reached
 * (`toAccountId`). Sides without an account are tracked as "not in an account", so finance
 * works with or without accounts set up.
 *
 * Values are stored, so existing keys never change; new ones are only ever added.
 */

export const ENTRY_KINDS = ['income', 'expense', 'investment', 'saving', 'transfer'] as const;
export type EntryKind = (typeof ENTRY_KINDS)[number];

export const ENTRY_KIND_LABELS: Record<EntryKind, string> = {
  income: 'Income',
  expense: 'Expense',
  investment: 'Investment',
  saving: 'Saving',
  transfer: 'Transfer',
};

/* ---------- Expense categories: groups with subcategories ---------- */

interface CategoryGroup {
  key: string;
  label: string;
  subcategories: readonly (readonly [key: string, label: string])[];
}

/**
 * Real-life spending, grouped. Subcategory keys are what entries store and are unique across
 * groups. Investments, savings, and loan principal are deliberately not here: they are their
 * own kinds (or transfers), so they never inflate spending.
 */
export const EXPENSE_GROUPS = [
  {
    key: 'home',
    label: 'Home',
    subcategories: [
      ['rent', 'Rent'],
      ['electricity', 'Electricity'],
      ['water', 'Water'],
      ['gas', 'Gas & LPG'],
      ['maintenance', 'Maintenance & repairs'],
      ['household_supplies', 'Household supplies'],
      ['home_other', 'Other home'],
    ],
  },
  {
    key: 'family',
    label: 'Family',
    subcategories: [
      ['parents_support', 'Parents’ living expenses'],
      ['family_support', 'Family support'],
      ['family_gifts', 'Gifts for family'],
      ['household_contribution', 'Shared household contribution'],
    ],
  },
  {
    key: 'transport',
    label: 'Transport',
    subcategories: [
      ['public_transport', 'Public transport'],
      ['cab', 'Cabs & autos'],
      ['metro', 'Metro'],
      ['fuel', 'Fuel'],
      ['vehicle_maintenance', 'Vehicle maintenance'],
      ['parking', 'Parking'],
      ['tolls', 'Tolls'],
      ['transport_other', 'Other transport'],
    ],
  },
  {
    key: 'personal',
    label: 'Personal',
    subcategories: [
      ['shopping', 'Shopping'],
      ['clothing', 'Clothing'],
      ['personal_care', 'Personal care'],
      ['wishes', 'Personal wishes'],
      ['hobbies', 'Hobbies'],
      ['misc', 'Miscellaneous'],
    ],
  },
  {
    key: 'food',
    label: 'Food',
    subcategories: [
      ['groceries', 'Groceries'],
      ['dining_out', 'Dining out'],
      ['cafe', 'Cafes'],
      ['food_delivery', 'Food delivery'],
      ['snacks', 'Snacks'],
    ],
  },
  {
    key: 'bills',
    label: 'Bills & subscriptions',
    subcategories: [
      ['mobile', 'Mobile recharge'],
      ['internet', 'Internet & broadband'],
      ['ott', 'OTT & streaming'],
      ['music', 'Music subscriptions'],
      ['subscriptions', 'Other subscriptions'],
      ['autopay', 'Recurring payments & autopay'],
      ['bills_other', 'Other bills'],
    ],
  },
  {
    key: 'health',
    label: 'Health & fitness',
    subcategories: [
      ['medical', 'Medical'],
      ['pharmacy', 'Pharmacy'],
      ['gym', 'Gym'],
      ['fitness_classes', 'Fitness classes'],
      ['wellness', 'Wellness'],
    ],
  },
  {
    key: 'lifestyle',
    label: 'Lifestyle & entertainment',
    subcategories: [
      ['travel', 'Travel'],
      ['outings', 'Outings'],
      ['movies', 'Movies'],
      ['events', 'Events'],
      ['entertainment', 'Entertainment'],
    ],
  },
  {
    key: 'financial',
    label: 'Financial',
    subcategories: [
      ['loan_interest', 'Loan interest'],
      ['insurance', 'Insurance premiums'],
      ['bank_charges', 'Bank charges & fees'],
      ['taxes', 'Taxes'],
      ['financial_other', 'Other financial'],
    ],
  },
  {
    key: 'gifting',
    label: 'Gifting & celebrations',
    subcategories: [
      ['birthdays', 'Birthdays'],
      ['festivals', 'Festivals'],
      ['occasions', 'Special occasions'],
      ['gifts', 'Personal gifts'],
    ],
  },
  { key: 'other', label: 'Other', subcategories: [['other', 'Other']] },
] as const satisfies readonly CategoryGroup[];

export type ExpenseGroupKey = (typeof EXPENSE_GROUPS)[number]['key'];
export type ExpenseCategory = (typeof EXPENSE_GROUPS)[number]['subcategories'][number][0];

export const EXPENSE_CATEGORIES: readonly ExpenseCategory[] =
  EXPENSE_GROUPS.flatMap<ExpenseCategory>((g) => g.subcategories.map(([key]) => key));

const SUBCATEGORY_INFO = new Map<string, { label: string; group: ExpenseGroupKey }>(
  EXPENSE_GROUPS.flatMap((g) =>
    g.subcategories.map(([key, label]) => [key, { label, group: g.key }] as const),
  ),
);

const GROUP_LABELS = new Map<string, string>(EXPENSE_GROUPS.map((g) => [g.key, g.label]));

export function isExpenseGroup(key: string): key is ExpenseGroupKey {
  return GROUP_LABELS.has(key);
}

/** Budgets can cover a whole group: stored as `group:<group key or custom group id>`. */
export const GROUP_PREFIX = 'group:';

/* ---------- Income ---------- */

export const INCOME_SOURCES = [
  'salary',
  'bonus',
  'freelance',
  'interest',
  'dividends',
  'rental',
  'gift',
  'refund',
  'other',
] as const;
export type IncomeSource = (typeof INCOME_SOURCES)[number];

export const INCOME_SOURCE_LABELS: Record<IncomeSource, string> = {
  salary: 'Salary',
  bonus: 'Bonus',
  freelance: 'Freelance',
  interest: 'Interest',
  dividends: 'Dividends',
  rental: 'Rental income',
  gift: 'Gift',
  refund: 'Refund & cashback',
  other: 'Other income',
};

/* ---------- Accounts & assets ---------- */

export const ACCOUNT_GROUPS = ['cash', 'investment', 'liability'] as const;
export type AccountGroup = (typeof ACCOUNT_GROUPS)[number];

export const ACCOUNT_GROUP_LABELS: Record<AccountGroup, string> = {
  cash: 'Bank & cash',
  investment: 'Investments',
  liability: 'Loans & cards',
};

export const ACCOUNT_TYPES = [
  'bank_savings',
  'bank_current',
  'cash',
  'kitty',
  'wallet',
  'other_cash',
  'mutual_fund',
  'sip',
  'fixed_deposit',
  'recurring_deposit',
  'gold_digital',
  'gold_physical',
  'stock',
  'etf',
  'bond',
  'ppf',
  'savings_scheme',
  'other_investment',
  'loan',
  'credit_card',
  'other_liability',
] as const;
export type AccountType = (typeof ACCOUNT_TYPES)[number];

export const ACCOUNT_TYPE_INFO: Record<AccountType, { label: string; group: AccountGroup }> = {
  bank_savings: { label: 'Savings account', group: 'cash' },
  bank_current: { label: 'Current account', group: 'cash' },
  cash: { label: 'Cash in hand', group: 'cash' },
  kitty: { label: 'Kitty / pooled fund', group: 'cash' },
  wallet: { label: 'Wallet', group: 'cash' },
  other_cash: { label: 'Other account', group: 'cash' },
  mutual_fund: { label: 'Mutual fund', group: 'investment' },
  sip: { label: 'SIP', group: 'investment' },
  fixed_deposit: { label: 'Fixed deposit', group: 'investment' },
  recurring_deposit: { label: 'Recurring deposit', group: 'investment' },
  gold_digital: { label: 'Digital gold', group: 'investment' },
  gold_physical: { label: 'Physical gold', group: 'investment' },
  stock: { label: 'Stocks', group: 'investment' },
  etf: { label: 'ETFs', group: 'investment' },
  bond: { label: 'Bonds', group: 'investment' },
  ppf: { label: 'PPF', group: 'investment' },
  savings_scheme: { label: 'Savings scheme (NSC, SSY, EPF…)', group: 'investment' },
  other_investment: { label: 'Other investment', group: 'investment' },
  loan: { label: 'Loan', group: 'liability' },
  credit_card: { label: 'Credit card', group: 'liability' },
  other_liability: { label: 'Other liability', group: 'liability' },
};

export const INVESTMENT_TYPES = ACCOUNT_TYPES.filter(
  (t) => ACCOUNT_TYPE_INFO[t].group === 'investment',
);
export type InvestmentType = (typeof ACCOUNT_TYPES)[number];

export function accountGroupOf(type: AccountType): AccountGroup {
  return ACCOUNT_TYPE_INFO[type].group;
}

export const SAVINGS_POTS = ['general', 'emergency'] as const;
export type SavingsPot = (typeof SAVINGS_POTS)[number];

export const SAVINGS_POT_LABELS: Record<SavingsPot, string> = {
  general: 'General savings',
  emergency: 'Emergency fund',
};

/** The only category a transfer has. */
export const TRANSFER_CATEGORY = 'transfer';

/**
 * A widely used guideline for an emergency fund: six months of expenses. The default for the
 * Settings preference; shown as a reference point, never enforced.
 */
export const EMERGENCY_FUND_MONTHS = 6;

/** Whole paise, positive. */
const amountSchema = z
  .number({ error: 'Enter an amount' })
  .int('Use at most two decimal places')
  .positive('Enter an amount above zero')
  .max(MAX_PAISE, 'That amount is too large');

const balanceSchema = z
  .number({ error: 'Enter an amount' })
  .int('Use at most two decimal places')
  .min(-MAX_PAISE, 'That amount is too large')
  .max(MAX_PAISE, 'That amount is too large');

const optionalAmountSchema = z
  .number()
  .int('Use at most two decimal places')
  .min(0, 'Use zero or more')
  .max(MAX_PAISE, 'That amount is too large')
  .optional();

export const accountSchema = z.object({
  id: idSchema,
  name: z.string().trim().min(1).max(80),
  type: z.enum(ACCOUNT_TYPES),
  /** Your own name for the type, e.g. "Chit fund" for an "Other …" account. */
  customType: optionalText(40),
  /** Bank, broker, or app, e.g. "HDFC Bank", "Zerodha". */
  institution: optionalText(80),
  /** A short reference such as the last four digits. Never a full account number. */
  identifier: optionalText(30),
  openedOn: dateKeySchema.optional(),
  note: optionalText(300),
  /**
   * What the account held at the end of `asOf`: the balance for bank and cash, the market
   * value (or amount invested, when not valued) for investments, and the amount owed for
   * loans and cards. Entries after that point move it (see `entryAfterCheckpoint`).
   */
  balance: balanceSchema,
  asOf: dateKeySchema,
  /** When `balance` was entered. Entries on `asOf` recorded after this still count. */
  balanceSetAt: timestampSchema,
  /** Investments: amount invested as of `asOf` (cost), so gains stay separate from money added. */
  invested: optionalAmountSchema,
  /** Investments: the date a market value was last entered. Absent means valued at cost. */
  valuedOn: dateKeySchema.optional(),
  /** Bank and cash only: this account holds savings (e.g. an emergency fund account). */
  savingsPot: z.enum(SAVINGS_POTS).optional(),
  archivedAt: timestampSchema.optional(),
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
});
export type Account = z.infer<typeof accountSchema>;

export const accountDraftSchema = z
  .object({
    name: z.string().trim().min(1, 'Name the account').max(80, 'Keep the name under 80 characters'),
    type: z.enum(ACCOUNT_TYPES),
    customType: optionalText(40),
    institution: optionalText(80),
    identifier: optionalText(30),
    openedOn: dateKeySchema.optional(),
    note: optionalText(300),
    /** Current balance, value, or amount owed. */
    balance: balanceSchema,
    /** Date the balance is true for. Defaults to today. */
    asOf: dateKeySchema.optional(),
    /** Investments: amount invested so far. Defaults to the balance. */
    invested: optionalAmountSchema,
    savingsPot: z.enum(SAVINGS_POTS).optional(),
  })
  .refine((a) => accountGroupOf(a.type) === 'cash' || a.balance >= 0, {
    path: ['balance'],
    message: 'Use zero or more',
  })
  .refine((a) => !/\d{9,}/.test(a.identifier ?? ''), {
    path: ['identifier'],
    message: 'Keep it short, like the last four digits',
  })
  .transform((a) => {
    const group = accountGroupOf(a.type);
    return {
      ...a,
      customType: a.type.startsWith('other_') ? a.customType : undefined,
      invested: group === 'investment' ? (a.invested ?? a.balance) : undefined,
      savingsPot: group === 'cash' ? a.savingsPot : undefined,
    };
  });
export type AccountDraft = z.input<typeof accountDraftSchema>;

/* ---------- Entries ---------- */

export const financeEntrySchema = z.object({
  id: idSchema,
  kind: z.enum(ENTRY_KINDS),
  /** Paise, always positive; `withdrawal` gives the direction for savings and investments. */
  amount: amountSchema,
  /** Local date the money moved (the payment date). */
  date: dateKeySchema,
  /**
   * An expense subcategory or custom category id for expenses, an income source or custom id
   * for income, an investment account type for investments, the pot for savings, and
   * `transfer` for transfers.
   */
  category: z.string().min(1).max(60),
  /** The account the money left. */
  accountId: idSchema.optional(),
  /** The account the money reached. */
  toAccountId: idSchema.optional(),
  /** Savings and investments only: money taken back out. */
  withdrawal: z.literal(true).optional(),
  /** Set when recorded from a recurring payment. */
  recurringId: idSchema.optional(),
  note: optionalText(200),
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
});
export type FinanceEntry = z.infer<typeof financeEntrySchema>;

const builtIn = (keys: readonly string[], category: string) => keys.includes(category);
const isCustomId = (category: string) => idSchema.safeParse(category).success;

export const financeEntryDraftSchema = z
  .object({
    kind: z.enum(ENTRY_KINDS),
    amount: amountSchema,
    date: dateKeySchema,
    category: z.string().trim().min(1, 'Choose a category').max(60),
    accountId: idSchema.optional(),
    toAccountId: idSchema.optional(),
    withdrawal: z.boolean().optional(),
    note: optionalText(200),
  })
  .superRefine((draft, ctx) => {
    const ok = (() => {
      switch (draft.kind) {
        case 'income':
          return builtIn(INCOME_SOURCES, draft.category) || isCustomId(draft.category);
        case 'expense':
          return builtIn(EXPENSE_CATEGORIES, draft.category) || isCustomId(draft.category);
        case 'investment':
          return builtIn(INVESTMENT_TYPES, draft.category);
        case 'saving':
          return builtIn(SAVINGS_POTS, draft.category);
        case 'transfer':
          return draft.category === TRANSFER_CATEGORY;
      }
    })();
    if (!ok) ctx.addIssue({ code: 'custom', path: ['category'], message: 'Choose a category' });
    if (draft.kind === 'transfer') {
      if (!draft.accountId) {
        ctx.addIssue({ code: 'custom', path: ['accountId'], message: 'Choose where it came from' });
      }
      if (!draft.toAccountId) {
        ctx.addIssue({ code: 'custom', path: ['toAccountId'], message: 'Choose where it went' });
      }
    }
    if (draft.accountId && draft.accountId === draft.toAccountId) {
      ctx.addIssue({
        code: 'custom',
        path: ['toAccountId'],
        message: 'Choose a different account',
      });
    }
  })
  .transform((draft) => {
    const movable = draft.kind === 'investment' || draft.kind === 'saving';
    return {
      ...draft,
      // Income only arrives somewhere; an expense only leaves somewhere.
      accountId: draft.kind === 'income' ? undefined : draft.accountId,
      toAccountId: draft.kind === 'expense' ? undefined : draft.toAccountId,
      withdrawal: movable && draft.withdrawal ? (true as const) : undefined,
    };
  });
export type FinanceEntryDraft = z.input<typeof financeEntryDraftSchema>;

/**
 * For savings and investments, which side is the savings/investment account and which is
 * the everyday account, given the direction.
 */
export function entrySides(entry: {
  accountId?: string | undefined;
  toAccountId?: string | undefined;
  withdrawal?: boolean | undefined;
}) {
  return entry.withdrawal
    ? { asset: entry.accountId, everyday: entry.toAccountId }
    : { asset: entry.toAccountId, everyday: entry.accountId };
}

/* ---------- Custom categories ---------- */

export const CUSTOM_CATEGORY_KINDS = ['income', 'expense'] as const;
export type CustomCategoryKind = (typeof CUSTOM_CATEGORY_KINDS)[number];

export const financeCategorySchema = z.object({
  id: idSchema,
  kind: z.enum(CUSTOM_CATEGORY_KINDS),
  name: z.string().trim().min(1).max(40),
  /**
   * Expenses: the group this subcategory belongs to, a built-in group key or a custom
   * top-level category's id. Absent makes it a group of its own.
   */
  parent: z.string().min(1).max(60).optional(),
  createdAt: timestampSchema,
});
export type FinanceCategory = z.infer<typeof financeCategorySchema>;

export const financeCategoryDraftSchema = z.object({
  kind: z.enum(CUSTOM_CATEGORY_KINDS),
  name: z.string().trim().min(1, 'Name the category').max(40, 'Keep the name under 40 characters'),
  parent: z.string().trim().min(1).max(60).optional(),
});
export type FinanceCategoryDraft = z.input<typeof financeCategoryDraftSchema>;

/* ---------- Recurring payments ---------- */

export const RECURRING_FREQUENCIES = ['weekly', 'monthly', 'quarterly', 'yearly'] as const;
export type RecurringFrequency = (typeof RECURRING_FREQUENCIES)[number];

export const RECURRING_FREQUENCY_LABELS: Record<RecurringFrequency, string> = {
  weekly: 'Every week',
  monthly: 'Every month',
  quarterly: 'Every 3 months',
  yearly: 'Every year',
};

export const recurringRuleSchema = z.object({
  id: idSchema,
  kind: z.enum(ENTRY_KINDS),
  amount: amountSchema,
  category: z.string().min(1).max(60),
  accountId: idSchema.optional(),
  toAccountId: idSchema.optional(),
  withdrawal: z.literal(true).optional(),
  note: optionalText(200),
  frequency: z.enum(RECURRING_FREQUENCIES),
  /** First payment date. Its day of the month anchors monthly, quarterly, and yearly dates. */
  startDate: dateKeySchema,
  /** The next payment that hasn't been recorded or skipped. */
  nextDue: dateKeySchema,
  /** Last date a payment can fall on. */
  endDate: dateKeySchema.optional(),
  /** Paid automatically by the bank or card (shown as a reminder to record it). */
  autopay: z.literal(true).optional(),
  /** Set once the end date has passed. */
  endedAt: timestampSchema.optional(),
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
});
export type RecurringRule = z.infer<typeof recurringRuleSchema>;

export const recurringDraftSchema = z
  .object({
    entry: financeEntryDraftSchema,
    frequency: z.enum(RECURRING_FREQUENCIES),
    endDate: dateKeySchema.optional(),
    autopay: z.boolean().optional(),
  })
  .refine((r) => r.endDate === undefined || r.endDate >= r.entry.date, {
    path: ['endDate'],
    message: 'End on or after the first payment',
  });
export type RecurringDraft = z.input<typeof recurringDraftSchema>;

/* ---------- Yearly goals ---------- */

export const GOAL_KINDS = ['savings', 'investment', 'spending'] as const;
export type GoalKind = (typeof GOAL_KINDS)[number];

export const GOAL_KIND_LABELS: Record<GoalKind, string> = {
  savings: 'Save',
  investment: 'Invest',
  spending: 'Spend at most',
};

export const GOAL_KIND_HINTS: Record<GoalKind, string> = {
  savings: 'Net money put into savings this year',
  investment: 'Net money invested this year',
  spending: 'A ceiling on this year’s expenses',
};

export const financeGoalSchema = z.object({
  id: idSchema,
  name: z.string().trim().min(1).max(80),
  kind: z.enum(GOAL_KINDS),
  /** Calendar year the goal measures, e.g. 2026. */
  year: z.number().int().min(2000).max(2100),
  /** Paise. For `spending` this is the ceiling. */
  target: amountSchema,
  /** Target date, inside `year`. */
  deadline: dateKeySchema,
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
});
export type FinanceGoal = z.infer<typeof financeGoalSchema>;

export const financeGoalDraftSchema = z
  .object({
    name: z.string().trim().min(1, 'Name the goal').max(80, 'Keep the name under 80 characters'),
    kind: z.enum(GOAL_KINDS),
    year: z.number().int().min(2000).max(2100),
    target: amountSchema,
    deadline: dateKeySchema.optional(),
  })
  .refine((g) => g.deadline === undefined || g.deadline.startsWith(`${g.year}-`), {
    path: ['deadline'],
    message: 'Pick a date in the goal’s year',
  })
  .transform((g) => ({ ...g, deadline: g.deadline ?? `${g.year}-12-31` }));
export type FinanceGoalDraft = z.input<typeof financeGoalDraftSchema>;

/* ---------- Budgets ---------- */

export const BUDGET_PERIODS = ['monthly', 'annual'] as const;
export type BudgetPeriod = (typeof BUDGET_PERIODS)[number];

/** The budget category that covers all expenses. */
export const ALL_EXPENSES = 'all';

export const budgetSchema = z.object({
  id: idSchema,
  period: z.enum(BUDGET_PERIODS),
  /** `all`, `group:<group>`, an expense subcategory, or a custom expense category id. */
  category: z.string().min(1).max(80),
  /** Paise. The same limit applies to every month (or year). */
  limit: amountSchema,
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
});
export type Budget = z.infer<typeof budgetSchema>;

export const budgetDraftSchema = z
  .object({
    period: z.enum(BUDGET_PERIODS),
    category: z.string().trim().min(1, 'Choose a category').max(80),
    limit: amountSchema,
  })
  .refine(
    (b) => {
      if (b.category === ALL_EXPENSES) return true;
      if (b.category.startsWith(GROUP_PREFIX)) {
        const group = b.category.slice(GROUP_PREFIX.length);
        return isExpenseGroup(group) || isCustomId(group);
      }
      return builtIn(EXPENSE_CATEGORIES, b.category) || isCustomId(b.category);
    },
    { path: ['category'], message: 'Choose a category' },
  );
export type BudgetDraft = z.input<typeof budgetDraftSchema>;

/* ---------- Salary ---------- */

export const salaryRecordSchema = z.object({
  id: idSchema,
  /** First date this salary applies. The latest one on or before today is current. */
  effectiveFrom: dateKeySchema,
  /** Monthly salary before deductions, in paise. */
  monthlyGross: amountSchema,
  /** Monthly take-home after tax and deductions, in paise. */
  monthlyInHand: amountSchema,
  /** Annual cost to company, in paise, if known. */
  annualCtc: amountSchema.optional(),
  employer: optionalText(80),
  note: optionalText(200),
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
});
export type SalaryRecord = z.infer<typeof salaryRecordSchema>;

export const salaryDraftSchema = z
  .object({
    effectiveFrom: dateKeySchema,
    monthlyGross: amountSchema,
    monthlyInHand: amountSchema,
    annualCtc: amountSchema.optional(),
    employer: optionalText(80),
    note: optionalText(200),
  })
  .refine((s) => s.monthlyInHand <= s.monthlyGross, {
    path: ['monthlyInHand'],
    message: 'In-hand pay can’t be more than gross pay',
  });
export type SalaryDraft = z.input<typeof salaryDraftSchema>;

/* ---------- Labels and grouping ---------- */

/** The group an expense category belongs to: a built-in group key or a custom group's id. */
export function expenseGroupOf(category: string, custom: readonly FinanceCategory[] = []): string {
  const info = SUBCATEGORY_INFO.get(category);
  if (info) return info.group;
  const own = custom.find((c) => c.id === category);
  if (own) return own.parent ?? own.id;
  return 'other';
}

export function expenseGroupLabel(group: string, custom: readonly FinanceCategory[] = []): string {
  return GROUP_LABELS.get(group) ?? custom.find((c) => c.id === group)?.name ?? 'Other';
}

/** Display name of an entry's or budget's category, resolving custom category ids. */
export function categoryLabel(
  kind: EntryKind,
  category: string,
  custom: readonly FinanceCategory[] = [],
): string {
  if (kind === 'expense') {
    if (category === ALL_EXPENSES) return 'All expenses';
    if (category.startsWith(GROUP_PREFIX)) {
      return expenseGroupLabel(category.slice(GROUP_PREFIX.length), custom);
    }
    const info = SUBCATEGORY_INFO.get(category);
    if (info) return info.label;
  }
  const labels: Record<string, string> = {
    income: INCOME_SOURCE_LABELS,
    expense: {},
    investment: Object.fromEntries(ACCOUNT_TYPES.map((t) => [t, ACCOUNT_TYPE_INFO[t].label])),
    saving: SAVINGS_POT_LABELS,
    transfer: { transfer: 'Transfer' },
  }[kind];
  return labels[category] ?? custom.find((c) => c.id === category)?.name ?? 'Removed category';
}

/** "Rent" alone, or "Home › Rent" when the group adds context. */
export function categoryPath(
  kind: EntryKind,
  category: string,
  custom: readonly FinanceCategory[] = [],
): string {
  const label = categoryLabel(kind, category, custom);
  if (kind !== 'expense') return label;
  const group = expenseGroupOf(category, custom);
  if (group === category) return label;
  return `${expenseGroupLabel(group, custom)} › ${label}`;
}

/** An account's type as shown: its custom name for "Other …" types. */
export function accountTypeLabel(account: Pick<Account, 'type' | 'customType'>): string {
  return account.customType ?? ACCOUNT_TYPE_INFO[account.type].label;
}
