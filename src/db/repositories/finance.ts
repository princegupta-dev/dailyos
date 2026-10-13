import {
  accountDraftSchema,
  accountGroupOf,
  ALL_EXPENSES,
  budgetDraftSchema,
  entrySides,
  financeCategoryDraftSchema,
  financeEntryDraftSchema,
  financeGoalDraftSchema,
  GROUP_PREFIX,
  isExpenseGroup,
  recurringDraftSchema,
  salaryDraftSchema,
  type Account,
  type AccountDraft,
  type AccountGroup,
  type Budget,
  type BudgetDraft,
  type FinanceCategory,
  type FinanceCategoryDraft,
  type FinanceEntry,
  type FinanceEntryDraft,
  type FinanceGoal,
  type FinanceGoalDraft,
  type RecurringDraft,
  type RecurringRule,
  type SalaryDraft,
  type SalaryRecord,
} from '@/domain/finance';
import { newId } from '@/lib/ids';
import { idSchema } from '@/lib/validation';
import { accountSummaries, nextOccurrence, type FinanceData } from '@/services/finance.service';
import { buildSampleFinance } from '@/services/financeSample';
import { db } from '../database';
import { AppError } from '../errors';
import { compact, guard, notFound, parseInput, writeContext, type WriteContext } from './internal';

const financeTables = () => [
  db.financeEntries,
  db.accounts,
  db.financeGoals,
  db.budgets,
  db.salaryRecords,
  db.financeCategories,
  db.recurringRules,
];

function fieldError(path: string, message: string): AppError {
  return new AppError('validation', 'Some fields need attention.', {
    issues: [{ path, message }],
  });
}

const isCustom = (category: string) => idSchema.safeParse(category).success;

/** A custom category id must exist and belong to the same kind. Call inside a transaction. */
async function assertCategory(kind: 'income' | 'expense', category: string): Promise<void> {
  if (!isCustom(category)) return;
  const found = await db.financeCategories.get(category);
  if (found?.kind !== kind) throw fieldError('category', 'That category no longer exists');
}

/* ---------- Accounts & assets ---------- */

async function requireAccount(id: string): Promise<Account> {
  const account = await db.accounts.get(id);
  if (!account) throw notFound('Account');
  return account;
}

export async function createAccount(draft: AccountDraft): Promise<Account> {
  const { asOf, ...fields } = parseInput(accountDraftSchema, draft);
  return guard(async () => {
    const ctx = await writeContext();
    if (asOf !== undefined && asOf > ctx.today) {
      throw fieldError('asOf', 'Pick today or an earlier day');
    }
    const account: Account = compact({
      id: newId(),
      ...fields,
      asOf: asOf ?? ctx.today,
      balanceSetAt: ctx.now,
      createdAt: ctx.now,
      updatedAt: ctx.now,
    });
    await db.accounts.add(account);
    return account;
  });
}

async function isUsed(id: string): Promise<boolean> {
  const entries =
    (await db.financeEntries.where('accountId').equals(id).count()) +
    (await db.financeEntries.where('toAccountId').equals(id).count());
  const rules = await db.recurringRules
    .filter((r) => r.accountId === id || r.toAccountId === id)
    .count();
  return entries + rules > 0;
}

/**
 * Edits an account's details. Entering a different balance (or date) starts a new
 * checkpoint, as with `setAccountBalance`; otherwise the balance history is untouched. The
 * type can change within its group (savings ↔ current, fund ↔ SIP), but not across groups
 * once money has moved, because past entries were checked against the old group.
 */
export async function updateAccount(id: string, draft: AccountDraft): Promise<Account> {
  const { asOf, ...fields } = parseInput(accountDraftSchema, draft);
  return guard(async () => {
    const ctx = await writeContext();
    if (asOf !== undefined && asOf > ctx.today) {
      throw fieldError('asOf', 'Pick today or an earlier day');
    }
    return db.transaction('rw', db.accounts, db.financeEntries, db.recurringRules, async () => {
      const existing = await requireAccount(id);
      const group = accountGroupOf(fields.type);
      if (accountGroupOf(existing.type) !== group && (await isUsed(id))) {
        throw fieldError('type', 'Choose a type in the same group: money has already moved here');
      }
      const resetBalance =
        fields.balance !== existing.balance || (asOf !== undefined && asOf !== existing.asOf);
      const account: Account = compact({
        ...existing,
        // Optional details left empty in the draft are cleared.
        institution: undefined,
        identifier: undefined,
        openedOn: undefined,
        note: undefined,
        ...fields,
        asOf: resetBalance ? (asOf ?? ctx.today) : existing.asOf,
        balanceSetAt: resetBalance ? ctx.now : existing.balanceSetAt,
        invested:
          group !== 'investment'
            ? undefined
            : resetBalance || draft.invested !== undefined
              ? fields.invested
              : existing.invested,
        valuedOn:
          group !== 'investment'
            ? undefined
            : resetBalance
              ? (asOf ?? ctx.today)
              : existing.valuedOn,
        updatedAt: ctx.now,
      });
      await db.accounts.put(account);
      return account;
    });
  });
}

/**
 * Records what an account holds now, from a statement, app, or broker: the balance, market
 * value, or amount owed. Entries dated after `asOf` (default today) keep moving it. For an
 * investment, the money invested so far is carried over, so the change shows as gain or loss.
 */
export async function setAccountBalance(
  id: string,
  balance: number,
  asOf?: string,
): Promise<Account> {
  return guard(async () => {
    const ctx = await writeContext();
    const date = asOf ?? ctx.today;
    if (date > ctx.today) throw fieldError('asOf', 'Pick today or an earlier day');
    return db.transaction('rw', db.accounts, db.financeEntries, async () => {
      const account = await requireAccount(id);
      const group = accountGroupOf(account.type);
      if (!Number.isSafeInteger(balance) || (group !== 'cash' && balance < 0)) {
        throw fieldError('balance', 'Use zero or more');
      }
      const entries = await db.financeEntries.toArray();
      const [summary] = accountSummaries([account], entries, date);
      const updated: Account = compact({
        ...account,
        balance,
        asOf: date,
        balanceSetAt: ctx.now,
        invested: group === 'investment' ? Math.max(summary?.invested ?? 0, 0) : undefined,
        valuedOn: group === 'investment' ? date : undefined,
        updatedAt: ctx.now,
      });
      await db.accounts.put(updated);
      return updated;
    });
  });
}

/** Hides a closed account from pickers. Its history and balance stay. */
export async function setAccountArchived(id: string, archived: boolean): Promise<Account> {
  return guard(async () => {
    const ctx = await writeContext();
    return db.transaction('rw', db.accounts, async () => {
      const account = await requireAccount(id);
      const updated: Account = compact({
        ...account,
        archivedAt: archived ? (account.archivedAt ?? ctx.now) : undefined,
        updatedAt: ctx.now,
      });
      await db.accounts.put(updated);
      return updated;
    });
  });
}

/** Deletes an account nothing refers to. One with history should be archived instead. */
export async function deleteAccount(id: string): Promise<void> {
  await guard(() =>
    db.transaction(
      'rw',
      [db.accounts, db.financeEntries, db.recurringRules, db.settings],
      async () => {
        if (await isUsed(id)) {
          throw new AppError(
            'invalid_operation',
            'This account has transactions. Archive it instead to keep its history.',
          );
        }
        await db.accounts.delete(id);
        await db.settings.toCollection().modify((s) => {
          if (s.defaultAccountId === id) delete s.defaultAccountId;
        });
      },
    ),
  );
}

/* ---------- Entries ---------- */

type ParsedEntry = ReturnType<typeof financeEntryDraftSchema.parse>;

const GROUP_NAMES: Record<AccountGroup, string> = {
  cash: 'a bank, cash, or wallet account',
  investment: 'an investment',
  liability: 'a loan or card',
};

/**
 * Checks the accounts an entry names: each must exist, be open (unless the entry already
 * used it), and be the right sort for its side. Investments and savings take their category
 * from their account, so totals by type always agree with balances.
 */
async function checkAccounts(
  fields: ParsedEntry,
  existing?: Pick<FinanceEntry, 'accountId' | 'toAccountId'>,
): Promise<ParsedEntry> {
  const load = async (id: string | undefined, path: string, allowed: readonly AccountGroup[]) => {
    if (id === undefined) return undefined;
    const account = await db.accounts.get(id);
    if (!account) throw fieldError(path, 'That account no longer exists');
    const reused = id === existing?.accountId || id === existing?.toAccountId;
    if (account.archivedAt && !reused) throw fieldError(path, 'That account is archived');
    if (!allowed.includes(accountGroupOf(account.type))) {
      throw fieldError(path, `Choose ${allowed.map((g) => GROUP_NAMES[g]).join(' or ')}`);
    }
    return account;
  };

  switch (fields.kind) {
    case 'income':
      await load(fields.toAccountId, 'toAccountId', ['cash']);
      return fields;
    case 'expense':
      await load(fields.accountId, 'accountId', ['cash', 'liability']);
      return fields;
    case 'transfer':
      await load(fields.accountId, 'accountId', ['cash', 'liability']);
      await load(fields.toAccountId, 'toAccountId', ['cash', 'liability']);
      return fields;
    case 'investment':
    case 'saving': {
      const sides = entrySides(fields);
      const assetPath = fields.withdrawal ? 'accountId' : 'toAccountId';
      const everydayPath = fields.withdrawal ? 'toAccountId' : 'accountId';
      const asset = await load(
        sides.asset,
        assetPath,
        fields.kind === 'investment' ? ['investment'] : ['cash'],
      );
      await load(sides.everyday, everydayPath, ['cash', 'liability']);
      if (fields.kind === 'investment' && asset) return { ...fields, category: asset.type };
      if (fields.kind === 'saving' && asset?.savingsPot) {
        return { ...fields, category: asset.savingsPot };
      }
      return fields;
    }
  }
}

async function checkEntry(
  ctx: WriteContext,
  parsed: ParsedEntry,
  existing?: FinanceEntry,
): Promise<ParsedEntry> {
  // Money that hasn't moved yet would skew balances and goal progress.
  if (parsed.date > ctx.today) throw fieldError('date', 'Pick today or an earlier day');
  if (parsed.kind === 'income' || parsed.kind === 'expense') {
    await assertCategory(parsed.kind, parsed.category);
  }
  return checkAccounts(parsed, existing);
}

export async function createFinanceEntry(draft: FinanceEntryDraft): Promise<FinanceEntry> {
  const parsed = parseInput(financeEntryDraftSchema, draft);
  return guard(async () => {
    const ctx = await writeContext();
    return db.transaction('rw', financeTables(), async () => {
      const fields = await checkEntry(ctx, parsed);
      const entry: FinanceEntry = compact({
        id: newId(),
        ...fields,
        createdAt: ctx.now,
        updatedAt: ctx.now,
      });
      await db.financeEntries.add(entry);
      return entry;
    });
  });
}

export async function updateFinanceEntry(
  id: string,
  draft: FinanceEntryDraft,
): Promise<FinanceEntry> {
  const parsed = parseInput(financeEntryDraftSchema, draft);
  return guard(async () => {
    const ctx = await writeContext();
    return db.transaction('rw', financeTables(), async () => {
      const existing = await db.financeEntries.get(id);
      if (!existing) throw notFound('Transaction');
      const fields = await checkEntry(ctx, parsed, existing);
      const entry: FinanceEntry = compact({
        id,
        ...fields,
        recurringId: existing.recurringId,
        createdAt: existing.createdAt,
        updatedAt: ctx.now,
      });
      await db.financeEntries.put(entry);
      return entry;
    });
  });
}

export async function deleteFinanceEntry(id: string): Promise<void> {
  await guard(() => db.financeEntries.delete(id));
}

/* ---------- Custom categories ---------- */

/**
 * Adds a custom income or expense category, or returns the existing one with that name in the
 * same place. An expense category can sit under a built-in group (a subcategory), under a
 * custom top-level category, or be a top-level group of its own.
 */
export async function createFinanceCategory(draft: FinanceCategoryDraft): Promise<FinanceCategory> {
  const fields = parseInput(financeCategoryDraftSchema, draft);
  return guard(async () => {
    const ctx = await writeContext();
    return db.transaction('rw', db.financeCategories, async () => {
      const parent = fields.kind === 'expense' ? fields.parent : undefined;
      if (parent !== undefined && !isExpenseGroup(parent)) {
        const group = await db.financeCategories.get(parent);
        if (group?.kind !== 'expense' || group.parent !== undefined) {
          throw fieldError('parent', 'Choose a group');
        }
      }
      const same = (await db.financeCategories.where('kind').equals(fields.kind).toArray()).find(
        (c) =>
          c.parent === parent &&
          c.name.localeCompare(fields.name, undefined, { sensitivity: 'accent' }) === 0,
      );
      if (same) return same;
      const category: FinanceCategory = compact({
        id: newId(),
        kind: fields.kind,
        name: fields.name,
        parent,
        createdAt: ctx.now,
      });
      await db.financeCategories.add(category);
      return category;
    });
  });
}

/** Removes a custom category. Refused while anything still uses it. */
export async function deleteFinanceCategory(id: string): Promise<void> {
  await guard(() =>
    db.transaction(
      'rw',
      [db.financeCategories, db.financeEntries, db.budgets, db.recurringRules],
      async () => {
        const used =
          (await db.financeEntries.filter((e) => e.category === id).count()) +
          (await db.budgets
            .filter((b) => b.category === id || b.category === `${GROUP_PREFIX}${id}`)
            .count()) +
          (await db.recurringRules.filter((r) => r.category === id).count()) +
          (await db.financeCategories.filter((c) => c.parent === id).count());
        if (used > 0) {
          throw new AppError(
            'invalid_operation',
            'This category is still in use. Move its transactions, budgets, and subcategories first.',
          );
        }
        await db.financeCategories.delete(id);
      },
    ),
  );
}

/* ---------- Recurring payments ---------- */

async function requireRule(id: string): Promise<RecurringRule> {
  const rule = await db.recurringRules.get(id);
  if (!rule) throw notFound('Recurring payment');
  return rule;
}

async function buildRule(
  draft: RecurringDraft,
  ctx: WriteContext,
  existing?: RecurringRule,
): Promise<RecurringRule> {
  const { entry, frequency, endDate, autopay } = parseInput(recurringDraftSchema, draft);
  if (entry.kind === 'income' || entry.kind === 'expense') {
    await assertCategory(entry.kind, entry.category);
  }
  // A schedule can start in the future; each payment is checked again when it's recorded.
  const fields = await checkAccounts(entry, existing);
  const restart = existing === undefined || existing.startDate !== entry.date;
  const nextDue = restart ? entry.date : existing.nextDue;
  return compact({
    id: existing?.id ?? newId(),
    kind: fields.kind,
    amount: fields.amount,
    category: fields.category,
    accountId: fields.accountId,
    toAccountId: fields.toAccountId,
    withdrawal: fields.withdrawal,
    note: fields.note,
    frequency,
    startDate: entry.date,
    nextDue,
    endDate,
    autopay: autopay ? (true as const) : undefined,
    endedAt:
      endDate !== undefined && nextDue > endDate ? (existing?.endedAt ?? ctx.now) : undefined,
    createdAt: existing?.createdAt ?? ctx.now,
    updatedAt: ctx.now,
  });
}

/**
 * A payment that repeats, e.g. rent on the 5th, a monthly SIP, or a yearly premium. With
 * `recordFirst`, a first payment dated today or earlier is recorded at the same time.
 */
export async function createRecurring(
  draft: RecurringDraft,
  { recordFirst = false } = {},
): Promise<RecurringRule> {
  return guard(async () => {
    const ctx = await writeContext();
    return db.transaction('rw', financeTables(), async () => {
      const rule = await buildRule(draft, ctx);
      await db.recurringRules.add(rule);
      if (recordFirst && rule.nextDue <= ctx.today) await recordOne(rule, ctx);
      return requireRule(rule.id);
    });
  });
}

/** Edits a schedule. Payments already recorded stay as they were. */
export async function updateRecurring(id: string, draft: RecurringDraft): Promise<RecurringRule> {
  return guard(async () => {
    const ctx = await writeContext();
    return db.transaction(
      'rw',
      [db.recurringRules, db.accounts, db.financeCategories],
      async () => {
        const rule = await buildRule(draft, ctx, await requireRule(id));
        await db.recurringRules.put(rule);
        return rule;
      },
    );
  });
}

export async function deleteRecurring(id: string): Promise<void> {
  await guard(() => db.recurringRules.delete(id));
}

function advance(rule: RecurringRule, ctx: WriteContext): RecurringRule {
  const nextDue = nextOccurrence(rule.nextDue, rule.frequency, rule.startDate);
  const ended = rule.endDate !== undefined && nextDue > rule.endDate;
  return compact({ ...rule, nextDue, endedAt: ended ? ctx.now : undefined, updatedAt: ctx.now });
}

async function recordOne(
  rule: RecurringRule,
  ctx: WriteContext,
  amount?: number,
): Promise<FinanceEntry> {
  if (rule.endedAt !== undefined) {
    throw new AppError('invalid_operation', 'This recurring payment has ended.');
  }
  if (rule.nextDue > ctx.today) {
    throw new AppError('invalid_operation', 'This payment isn’t due yet.');
  }
  const parsed = parseInput(financeEntryDraftSchema, {
    kind: rule.kind,
    amount: amount ?? rule.amount,
    date: rule.nextDue,
    category: rule.category,
    accountId: rule.accountId,
    toAccountId: rule.toAccountId,
    withdrawal: rule.withdrawal,
    note: rule.note,
  });
  const fields = await checkEntry(ctx, parsed);
  const entry: FinanceEntry = compact({
    id: newId(),
    ...fields,
    recurringId: rule.id,
    createdAt: ctx.now,
    updatedAt: ctx.now,
  });
  await db.financeEntries.add(entry);
  await db.recurringRules.put(advance(rule, ctx));
  return entry;
}

/**
 * Records the payment that's due (optionally for a different amount, e.g. this month's
 * electricity bill) and moves the schedule to the next date.
 */
export async function recordRecurring(id: string, amount?: number): Promise<FinanceEntry> {
  return guard(async () => {
    const ctx = await writeContext();
    return db.transaction('rw', financeTables(), async () =>
      recordOne(await requireRule(id), ctx, amount),
    );
  });
}

/** Skips the payment that's due without recording it, e.g. a month the rent was waived. */
export async function skipRecurring(id: string): Promise<RecurringRule> {
  return guard(async () => {
    const ctx = await writeContext();
    return db.transaction('rw', db.recurringRules, async () => {
      const rule = await requireRule(id);
      if (rule.endedAt !== undefined || rule.nextDue > ctx.today) {
        throw new AppError('invalid_operation', 'There’s no payment due to skip.');
      }
      const next = advance(rule, ctx);
      await db.recurringRules.put(next);
      return next;
    });
  });
}

/** Records every payment due up to today, catching up on missed ones. Returns how many. */
export async function recordAllDue(): Promise<number> {
  return guard(async () => {
    const ctx = await writeContext();
    return db.transaction('rw', financeTables(), async () => {
      let count = 0;
      for (const start of await db.recurringRules.toArray()) {
        let rule = start;
        while (rule.endedAt === undefined && rule.nextDue <= ctx.today) {
          await recordOne(rule, ctx);
          rule = await requireRule(rule.id);
          count += 1;
        }
      }
      return count;
    });
  });
}

/* ---------- Goals ---------- */

export async function createFinanceGoal(draft: FinanceGoalDraft): Promise<FinanceGoal> {
  const fields = parseInput(financeGoalDraftSchema, draft);
  return guard(async () => {
    const ctx = await writeContext();
    const goal: FinanceGoal = { id: newId(), ...fields, createdAt: ctx.now, updatedAt: ctx.now };
    await db.financeGoals.add(goal);
    return goal;
  });
}

export async function updateFinanceGoal(id: string, draft: FinanceGoalDraft): Promise<FinanceGoal> {
  const fields = parseInput(financeGoalDraftSchema, draft);
  return guard(async () => {
    const ctx = await writeContext();
    return db.transaction('rw', db.financeGoals, async () => {
      const existing = await db.financeGoals.get(id);
      if (!existing) throw notFound('Goal');
      const goal: FinanceGoal = { ...existing, ...fields, updatedAt: ctx.now };
      await db.financeGoals.put(goal);
      return goal;
    });
  });
}

export async function deleteFinanceGoal(id: string): Promise<void> {
  await guard(() => db.financeGoals.delete(id));
}

/* ---------- Budgets ---------- */

/**
 * Sets the limit for one period and category (or group), replacing any existing budget for
 * the same pair (the unique [period+category] index allows only one). Pass `id` when editing
 * so a budget moved to another category doesn't leave its old one behind.
 */
export async function saveBudget(draft: BudgetDraft, id?: string): Promise<Budget> {
  const fields = parseInput(budgetDraftSchema, draft);
  return guard(async () => {
    const ctx = await writeContext();
    return db.transaction('rw', db.budgets, db.financeCategories, async () => {
      if (fields.category !== ALL_EXPENSES) {
        const target = fields.category.startsWith(GROUP_PREFIX)
          ? fields.category.slice(GROUP_PREFIX.length)
          : fields.category;
        await assertCategory('expense', target);
      }
      const editing = id === undefined ? undefined : await db.budgets.get(id);
      if (id !== undefined && !editing) throw notFound('Budget');
      const same = await db.budgets
        .where('[period+category]')
        .equals([fields.period, fields.category])
        .first();
      const budgetId = editing?.id ?? same?.id ?? newId();
      if (same && same.id !== budgetId) await db.budgets.delete(same.id);
      const budget: Budget = {
        id: budgetId,
        ...fields,
        createdAt: editing?.createdAt ?? same?.createdAt ?? ctx.now,
        updatedAt: ctx.now,
      };
      await db.budgets.put(budget);
      return budget;
    });
  });
}

export async function deleteBudget(id: string): Promise<void> {
  await guard(() => db.budgets.delete(id));
}

/* ---------- Salary ---------- */

async function assertFreeStart(effectiveFrom: string, id?: string): Promise<void> {
  const same = await db.salaryRecords.where('effectiveFrom').equals(effectiveFrom).first();
  if (same && same.id !== id) {
    throw fieldError('effectiveFrom', 'Another salary already starts on this date');
  }
}

export async function createSalaryRecord(draft: SalaryDraft): Promise<SalaryRecord> {
  const fields = parseInput(salaryDraftSchema, draft);
  return guard(async () => {
    const ctx = await writeContext();
    return db.transaction('rw', db.salaryRecords, async () => {
      await assertFreeStart(fields.effectiveFrom);
      const record: SalaryRecord = compact({
        id: newId(),
        ...fields,
        createdAt: ctx.now,
        updatedAt: ctx.now,
      });
      await db.salaryRecords.add(record);
      return record;
    });
  });
}

export async function updateSalaryRecord(id: string, draft: SalaryDraft): Promise<SalaryRecord> {
  const fields = parseInput(salaryDraftSchema, draft);
  return guard(async () => {
    const ctx = await writeContext();
    return db.transaction('rw', db.salaryRecords, async () => {
      const existing = await db.salaryRecords.get(id);
      if (!existing) throw notFound('Salary');
      await assertFreeStart(fields.effectiveFrom, id);
      const record: SalaryRecord = compact({
        id,
        ...fields,
        createdAt: existing.createdAt,
        updatedAt: ctx.now,
      });
      await db.salaryRecords.put(record);
      return record;
    });
  });
}

export async function deleteSalaryRecord(id: string): Promise<void> {
  await guard(() => db.salaryRecords.delete(id));
}

/* ---------- Sample data ---------- */

/**
 * Fills an empty finance section with six months of realistic example data, so the screens
 * can be explored before real numbers are entered. Refused once any finance data exists, so
 * it can never mix with real records.
 */
export async function loadSampleFinance(): Promise<void> {
  await guard(async () => {
    const ctx = await writeContext();
    await db.transaction('rw', financeTables(), async () => {
      const counts = await Promise.all(financeTables().map((t) => t.count()));
      if (counts.some((c) => c > 0)) {
        throw new AppError(
          'invalid_operation',
          'Sample data can only be added before you record anything.',
        );
      }
      const sample = buildSampleFinance(ctx.today, ctx.now, newId);
      await db.salaryRecords.bulkAdd(sample.salaries);
      await db.accounts.bulkAdd(sample.accounts);
      await db.financeEntries.bulkAdd(sample.entries);
      await db.budgets.bulkAdd(sample.budgets);
      await db.financeGoals.bulkAdd(sample.goals);
      await db.recurringRules.bulkAdd(sample.recurring);
    });
  });
}

/** Removes every finance record. Habits, tasks, and everything else are untouched. */
export async function clearFinanceData(): Promise<void> {
  await guard(() =>
    db.transaction('rw', [...financeTables(), db.settings], async () => {
      await Promise.all(financeTables().map((t) => t.clear()));
      await db.settings.toCollection().modify((s) => {
        delete s.defaultAccountId;
      });
    }),
  );
}

/* ---------- Reads ---------- */

/* Reads call Dexie directly so live queries track them (see the note in tasks.ts). */

/**
 * Every finance record. A personal ledger stays in the thousands of rows, so screens load
 * it once and derive their numbers in memory (services/finance.service.ts).
 */
export async function getFinanceData(): Promise<FinanceData> {
  const [entries, accounts, goals, budgets, salaries, categories, recurring] = await Promise.all([
    db.financeEntries.toArray(),
    db.accounts.toArray(),
    db.financeGoals.toArray(),
    db.budgets.toArray(),
    db.salaryRecords.toArray(),
    db.financeCategories.toArray(),
    db.recurringRules.toArray(),
  ]);
  return {
    entries,
    accounts: accounts.sort((a, b) => a.name.localeCompare(b.name)),
    goals: goals.sort(
      (a, b) => a.deadline.localeCompare(b.deadline) || a.name.localeCompare(b.name),
    ),
    budgets,
    salaries,
    categories: categories.sort((a, b) => a.name.localeCompare(b.name)),
    recurring: recurring.sort((a, b) => a.nextDue.localeCompare(b.nextDue)),
  };
}
