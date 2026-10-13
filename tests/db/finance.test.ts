import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '@/db/database';
import {
  clearFinanceData,
  createAccount,
  createFinanceCategory,
  createFinanceEntry,
  createRecurring,
  createSalaryRecord,
  deleteAccount,
  deleteFinanceCategory,
  getFinanceData,
  loadSampleFinance,
  recordAllDue,
  recordRecurring,
  saveBudget,
  setAccountArchived,
  setAccountBalance,
  skipRecurring,
  updateAccount,
  updateFinanceEntry,
} from '@/db/repositories/finance';
import { createHabit } from '@/db/repositories/habits';
import { getSettings, updateSettings } from '@/db/repositories/settings';
import {
  accountSummaries,
  balanceSheet,
  isFinanceEmpty,
  liabilityIds,
  portfolioSummary,
  totalsOf,
} from '@/services/finance.service';
import { resetDatabase, setNow } from '../helpers/db';

const TODAY = '2026-10-09';

beforeEach(async () => {
  await resetDatabase('Asia/Kolkata');
  setNow(`${TODAY}T06:00:00Z`);
});

afterEach(() => {
  vi.useRealTimers();
});

const bankDraft = { name: 'Salary account', type: 'bank_savings' as const, balance: 10_000_00 };

describe('accounts', () => {
  it('creates an account with a balance as of today, and an investment with its cost', async () => {
    const bank = await createAccount({ ...bankDraft, identifier: '4821' });
    expect(bank).toMatchObject({ balance: 10_000_00, asOf: TODAY, identifier: '4821' });
    expect(bank.invested).toBeUndefined();

    const fund = await createAccount({ name: 'Fund', type: 'sip', balance: 5_000_00 });
    expect(fund).toMatchObject({ invested: 5_000_00 });
  });

  it('refuses full account numbers, future dates, and negative values outside bank and cash', async () => {
    await expect(createAccount({ ...bankDraft, identifier: '123456789012' })).rejects.toMatchObject(
      { issues: [{ path: 'identifier' }] },
    );
    await expect(createAccount({ ...bankDraft, asOf: '2026-10-10' })).rejects.toMatchObject({
      issues: [{ path: 'asOf' }],
    });
    await expect(createAccount({ name: 'Loan', type: 'loan', balance: -1 })).rejects.toMatchObject({
      issues: [{ path: 'balance' }],
    });
    // An overdrawn bank account is fine.
    await expect(createAccount({ ...bankDraft, balance: -500_00 })).resolves.toBeDefined();
  });

  it('updates a balance from a statement, keeping later entries moving it', async () => {
    const bank = await createAccount(bankDraft);
    setNow(`${TODAY}T07:00:00Z`);
    await createFinanceEntry({
      kind: 'expense',
      amount: 1_000_00,
      date: TODAY,
      category: 'groceries',
      accountId: bank.id,
    });
    const { entries } = await getFinanceData();
    expect(accountSummaries([bank], entries, TODAY)[0]?.value).toBe(9_000_00);

    setNow(`${TODAY}T08:00:00Z`);
    const updated = await setAccountBalance(bank.id, 8_500_00);
    setNow(`${TODAY}T09:00:00Z`);
    await createFinanceEntry({
      kind: 'expense',
      amount: 500_00,
      date: TODAY,
      category: 'cafe',
      accountId: bank.id,
    });
    const after = await getFinanceData();
    expect(accountSummaries([updated], after.entries, TODAY)[0]?.value).toBe(8_000_00);
  });

  it('carries the invested amount into a new market value, so the difference is gain', async () => {
    const fund = await createAccount({ name: 'Fund', type: 'mutual_fund', balance: 0 });
    setNow(`${TODAY}T07:00:00Z`);
    await createFinanceEntry({
      kind: 'investment',
      amount: 10_000_00,
      date: TODAY,
      category: 'mutual_fund',
      toAccountId: fund.id,
    });
    setNow(`${TODAY}T10:00:00Z`);
    const valued = await setAccountBalance(fund.id, 11_000_00);
    expect(valued).toMatchObject({ invested: 10_000_00, valuedOn: TODAY });
    const data = await getFinanceData();
    expect(portfolioSummary(data, TODAY)).toMatchObject({
      value: 11_000_00,
      invested: 10_000_00,
      gain: 1_000_00,
    });
  });

  it('archives used accounts, deletes unused ones, and blocks changing group once used', async () => {
    const bank = await createAccount(bankDraft);
    const spare = await createAccount({ ...bankDraft, name: 'Spare' });
    await updateSettings({ defaultAccountId: spare.id });
    await createFinanceEntry({
      kind: 'expense',
      amount: 100,
      date: TODAY,
      category: 'cafe',
      accountId: bank.id,
    });

    await expect(deleteAccount(bank.id)).rejects.toMatchObject({ kind: 'invalid_operation' });
    await expect(updateAccount(bank.id, { ...bankDraft, type: 'sip' })).rejects.toMatchObject({
      issues: [{ path: 'type' }],
    });
    await expect(
      updateAccount(bank.id, { ...bankDraft, type: 'bank_current' }),
    ).resolves.toMatchObject({ type: 'bank_current' });

    await setAccountArchived(bank.id, true);
    await expect(
      createFinanceEntry({
        kind: 'expense',
        amount: 100,
        date: TODAY,
        category: 'cafe',
        accountId: bank.id,
      }),
    ).rejects.toMatchObject({ issues: [{ path: 'accountId' }] });

    await deleteAccount(spare.id);
    expect((await getSettings()).defaultAccountId).toBeUndefined();
  });
});

describe('transactions and accounts', () => {
  it('checks each side is the right kind of account', async () => {
    const bank = await createAccount(bankDraft);
    const fund = await createAccount({ name: 'Fund', type: 'sip', balance: 0 });
    const card = await createAccount({ name: 'Card', type: 'credit_card', balance: 0 });

    await expect(
      createFinanceEntry({
        kind: 'income',
        amount: 100,
        date: TODAY,
        category: 'salary',
        toAccountId: card.id,
      }),
    ).rejects.toMatchObject({ issues: [{ path: 'toAccountId' }] });
    await expect(
      createFinanceEntry({
        kind: 'expense',
        amount: 100,
        date: TODAY,
        category: 'cafe',
        accountId: fund.id,
      }),
    ).rejects.toMatchObject({ issues: [{ path: 'accountId' }] });
    await expect(
      createFinanceEntry({
        kind: 'transfer',
        amount: 100,
        date: TODAY,
        category: 'transfer',
        accountId: bank.id,
        toAccountId: fund.id,
      }),
    ).rejects.toMatchObject({ issues: [{ path: 'toAccountId' }] });
    await expect(
      createFinanceEntry({
        kind: 'transfer',
        amount: 100,
        date: TODAY,
        category: 'transfer',
        accountId: bank.id,
      }),
    ).rejects.toMatchObject({ kind: 'validation' });

    // Paying for something on a card is fine.
    await expect(
      createFinanceEntry({
        kind: 'expense',
        amount: 100,
        date: TODAY,
        category: 'cafe',
        accountId: card.id,
      }),
    ).resolves.toBeDefined();
  });

  it('takes an investment’s type and a saving’s pot from their accounts', async () => {
    const fund = await createAccount({ name: 'Fund', type: 'ppf', balance: 0 });
    const emergency = await createAccount({
      ...bankDraft,
      name: 'Emergency',
      savingsPot: 'emergency',
    });
    const invested = await createFinanceEntry({
      kind: 'investment',
      amount: 100,
      date: TODAY,
      category: 'stock',
      toAccountId: fund.id,
    });
    const saved = await createFinanceEntry({
      kind: 'saving',
      amount: 100,
      date: TODAY,
      category: 'general',
      toAccountId: emergency.id,
    });
    expect(invested.category).toBe('ppf');
    expect(saved.category).toBe('emergency');
  });

  it('keeps a withdrawal’s accounts the right way round', async () => {
    const bank = await createAccount(bankDraft);
    const fund = await createAccount({ name: 'Fund', type: 'mutual_fund', balance: 5_000_00 });
    setNow(`${TODAY}T07:00:00Z`);
    await createFinanceEntry({
      kind: 'investment',
      amount: 2_000_00,
      date: TODAY,
      category: 'mutual_fund',
      accountId: fund.id,
      toAccountId: bank.id,
      withdrawal: true,
    });
    const data = await getFinanceData();
    const [b, f] = accountSummaries([bank, fund], data.entries, TODAY);
    expect(b?.value).toBe(12_000_00);
    expect(f).toMatchObject({ value: 3_000_00, invested: 3_000_00 });
  });

  it('refuses future dates and keeps a recurring link on edit', async () => {
    await expect(
      createFinanceEntry({ kind: 'expense', amount: 100, date: '2026-10-10', category: 'cafe' }),
    ).rejects.toMatchObject({ issues: [{ path: 'date' }] });

    const rule = await createRecurring({
      entry: { kind: 'expense', amount: 100, date: TODAY, category: 'ott' },
      frequency: 'monthly',
    });
    const entry = await recordRecurring(rule.id);
    const edited = await updateFinanceEntry(entry.id, {
      kind: 'expense',
      amount: 120,
      date: TODAY,
      category: 'ott',
    });
    expect(edited.recurringId).toBe(rule.id);
  });
});

describe('categories', () => {
  it('adds custom subcategories under a group, and top-level groups', async () => {
    const tuition = await createFinanceCategory({
      kind: 'expense',
      name: 'Tuition',
      parent: 'family',
    });
    const pets = await createFinanceCategory({ kind: 'expense', name: 'Pets' });
    const vet = await createFinanceCategory({ kind: 'expense', name: 'Vet', parent: pets.id });
    expect(tuition.parent).toBe('family');
    expect(vet.parent).toBe(pets.id);
    // Same name in the same place is the same category.
    expect(
      await createFinanceCategory({ kind: 'expense', name: 'tuition', parent: 'family' }),
    ).toEqual(tuition);
    // No sub-subcategories.
    await expect(
      createFinanceCategory({ kind: 'expense', name: 'X', parent: vet.id }),
    ).rejects.toMatchObject({ issues: [{ path: 'parent' }] });
    // A group with subcategories can't be removed.
    await expect(deleteFinanceCategory(pets.id)).rejects.toMatchObject({
      kind: 'invalid_operation',
    });
    await expect(
      createFinanceEntry({ kind: 'income', amount: 500, date: TODAY, category: vet.id }),
    ).rejects.toMatchObject({ kind: 'validation' });
  });
});

describe('recurring payments', () => {
  it('records the due payment, moves to the next date, and can skip', async () => {
    const bank = await createAccount(bankDraft);
    const rule = await createRecurring({
      entry: {
        kind: 'expense',
        amount: 22_000_00,
        date: '2026-08-31',
        category: 'rent',
        accountId: bank.id,
        note: 'Rent',
      },
      frequency: 'monthly',
    });
    expect(rule.nextDue).toBe('2026-08-31');

    const first = await recordRecurring(rule.id, 21_000_00);
    expect(first).toMatchObject({ date: '2026-08-31', amount: 21_000_00, recurringId: rule.id });
    expect((await db.recurringRules.get(rule.id))?.nextDue).toBe('2026-09-30');

    const skipped = await skipRecurring(rule.id);
    expect(skipped.nextDue).toBe('2026-10-31');
    await expect(recordRecurring(rule.id)).rejects.toMatchObject({ kind: 'invalid_operation' });
  });

  it('catches up on every missed payment and ends after the end date', async () => {
    await createRecurring({
      entry: { kind: 'expense', amount: 100_00, date: '2026-09-18', category: 'gym' },
      frequency: 'weekly',
      endDate: '2026-10-02',
    });
    expect(await recordAllDue()).toBe(3);
    const data = await getFinanceData();
    expect(data.entries.map((e) => e.date).sort()).toEqual([
      '2026-09-18',
      '2026-09-25',
      '2026-10-02',
    ]);
    expect(data.recurring[0]?.endedAt).toBeDefined();
    expect(await recordAllDue()).toBe(0);
  });

  it('records the first payment when set up from a transaction', async () => {
    const rule = await createRecurring(
      {
        entry: { kind: 'expense', amount: 649_00, date: TODAY, category: 'ott' },
        frequency: 'monthly',
        autopay: true,
      },
      { recordFirst: true },
    );
    expect(rule).toMatchObject({ nextDue: '2026-11-09', autopay: true });
    expect((await getFinanceData()).entries).toHaveLength(1);
  });
});

describe('budgets and salary', () => {
  it('keeps one budget per period and category, including whole groups', async () => {
    const first = await saveBudget({ period: 'monthly', category: 'group:food', limit: 5_000_00 });
    const second = await saveBudget({ period: 'monthly', category: 'group:food', limit: 6_000_00 });
    await saveBudget({ period: 'annual', category: 'group:food', limit: 60_000_00 });
    const { budgets } = await getFinanceData();
    expect(budgets).toHaveLength(2);
    expect(second.id).toBe(first.id);
    await expect(
      saveBudget({ period: 'monthly', category: 'group:nonsense', limit: 1 }),
    ).rejects.toMatchObject({ issues: [{ path: 'category' }] });
  });

  it('refuses two salaries starting on the same day, or in-hand above gross', async () => {
    await createSalaryRecord({
      effectiveFrom: '2026-04-01',
      monthlyGross: 1_00_000_00,
      monthlyInHand: 80_000_00,
    });
    await expect(
      createSalaryRecord({
        effectiveFrom: '2026-04-01',
        monthlyGross: 1_10_000_00,
        monthlyInHand: 85_000_00,
      }),
    ).rejects.toMatchObject({ issues: [{ path: 'effectiveFrom' }] });
    await expect(
      createSalaryRecord({ effectiveFrom: '2026-05-01', monthlyGross: 100, monthlyInHand: 200 }),
    ).rejects.toMatchObject({ issues: [{ path: 'monthlyInHand' }] });
  });
});

describe('sample data', () => {
  it('fills an empty finance section with consistent, past-dated records', async () => {
    await loadSampleFinance();
    const data = await getFinanceData();
    expect(isFinanceEmpty(data)).toBe(false);
    expect(data.entries.every((e) => e.date <= TODAY)).toBe(true);
    const ids = new Set(data.accounts.map((a) => a.id));
    expect(
      data.entries.every(
        (e) =>
          (e.accountId === undefined || ids.has(e.accountId)) &&
          (e.toAccountId === undefined || ids.has(e.toAccountId)),
      ),
    ).toBe(true);
    const totals = totalsOf(data.entries, liabilityIds(data.accounts));
    expect(totals.income).toBeGreaterThan(totals.expenses);
    expect(totals.repaid).toBeGreaterThan(0);
    // Card bills are repayments: card spending isn't counted twice.
    const sheet = balanceSheet(data, TODAY);
    expect(sheet.liabilities).toBeGreaterThan(0);
    expect(portfolioSummary(data, TODAY).unassigned).toBe(0);
    expect(data.recurring.some((r) => r.nextDue <= TODAY)).toBe(true);
  });

  it('is refused once real data exists, and clearing leaves habits alone', async () => {
    await createHabit({ name: 'Read', category: 'reading', frequency: 'daily' });
    await createFinanceEntry({ kind: 'expense', amount: 100, date: TODAY, category: 'cafe' });
    await expect(loadSampleFinance()).rejects.toMatchObject({ kind: 'invalid_operation' });

    await clearFinanceData();
    expect(isFinanceEmpty(await getFinanceData())).toBe(true);
    expect(await db.habits.count()).toBe(1);
  });
});
