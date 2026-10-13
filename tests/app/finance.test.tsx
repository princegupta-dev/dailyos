import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createHabit } from '@/db/repositories/habits';
import { getFinanceData, loadSampleFinance } from '@/db/repositories/finance';
import { formatINR, PAISE_PER_RUPEE } from '@/lib/money';
import { resetDatabase, setNow } from '../helpers/db';
import { renderApp } from '../helpers/render';

beforeEach(async () => {
  await resetDatabase('UTC');
  setNow('2026-10-09T09:00:00Z');
});

afterEach(() => {
  vi.useRealTimers();
});

describe('Investments', () => {
  it('starts empty, records an expense with inline validation, then edits and deletes it', async () => {
    const user = userEvent.setup();
    renderApp('/investments');
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Investments' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Expense Tracker')).toBeInTheDocument();
    await screen.findByRole('heading', { name: 'Your money, next to your habits' });

    await user.click(screen.getByRole('button', { name: 'Add Expense' }));
    const dialog = screen.getByRole('dialog', { name: 'Add transaction' });
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));
    expect(within(dialog).getByText('Enter an amount like 1500 or 1,500.50')).toBeInTheDocument();

    await user.type(within(dialog).getByLabelText('Amount (₹)'), '1,250.50');
    // Categories are grouped: Dining out sits under Food.
    const category = within(dialog).getByLabelText('Category');
    expect(within(category).getByRole('group', { name: 'Food' })).toBeInTheDocument();
    await user.selectOptions(category, 'dining_out');
    await user.type(within(dialog).getByLabelText('Note'), 'Team lunch');
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('Expense recorded')).toBeInTheDocument();

    // Spending more than was earned shows as a negative net worth, never hidden.
    const hero = await screen.findByRole('region', { name: 'Net worth' });
    expect(within(hero).getAllByText('−₹1,250.50').length).toBeGreaterThan(0);

    await user.click(screen.getByRole('button', { name: /^Team lunch, Expense, Dining out/ }));
    const edit = screen.getByRole('dialog', { name: 'Edit transaction' });
    await user.click(within(edit).getByRole('button', { name: 'Delete' }));
    await user.click(
      within(screen.getByRole('dialog', { name: 'Delete this transaction?' })).getByRole('button', {
        name: 'Delete',
      }),
    );
    expect(await screen.findByText('Transaction deleted')).toBeInTheDocument();
    expect(
      await screen.findByRole('heading', { name: 'Your money, next to your habits' }),
    ).toBeInTheDocument();
  });

  it('adds a bank account and pays from it, moving its balance', async () => {
    const user = userEvent.setup();
    renderApp('/investments/accounts');
    await user.click(
      await screen.findByRole('button', { name: 'Add a bank account, cash, or wallet' }),
    );
    const add = screen.getByRole('dialog', { name: 'Add an account or asset' });
    await user.type(within(add).getByLabelText('Name'), 'Salary account');
    await user.type(within(add).getByLabelText('Current balance (₹)'), '20000');
    await user.type(within(add).getByLabelText(/^Reference/), '4821');
    await user.click(within(add).getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('Account added')).toBeInTheDocument();
    const card = await screen.findByRole('article', { name: 'Salary account' });
    expect(within(card).getByText('₹20,000')).toBeInTheDocument();
    expect(within(card).getByText(/••4821/)).toBeInTheDocument();

    setNow('2026-10-09T10:00:00Z');
    await user.click(screen.getByRole('button', { name: 'Add transaction' }));
    const dialog = screen.getByRole('dialog', { name: 'Add transaction' });
    await user.type(within(dialog).getByLabelText('Amount (₹)'), '1500');
    await user.selectOptions(
      within(dialog).getByLabelText('Paid from'),
      'Salary account · Savings account',
    );
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('Expense recorded')).toBeInTheDocument();
    expect(await within(card).findByText('₹18,500')).toBeInTheDocument();
  });

  it('explores every screen with sample data', async () => {
    const user = userEvent.setup();
    const first = renderApp('/investments');
    await user.click(await screen.findByRole('button', { name: 'Explore with sample data' }));
    expect(await screen.findByRole('region', { name: 'Net worth' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Income vs. expenses' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: '2026 goals' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Payments due' })).toBeInTheDocument();
    first.unmount();

    const accounts = renderApp('/investments/accounts');
    expect(await screen.findByRole('heading', { name: 'Nifty 50 index SIP' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Loans & cards' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: /^Investment allocation: / })).toBeInTheDocument();
    expect(screen.getByText(/months of expenses covered/)).toBeInTheDocument();
    accounts.unmount();

    const budgets = renderApp('/investments/budgets');
    expect(
      await screen.findAllByText('All expenses', { selector: '.budget-item__name' }),
    ).toHaveLength(2);
    expect(screen.getByText('Food', { selector: '.budget-item__name' })).toBeInTheDocument();
    budgets.unmount();

    const income = renderApp('/investments/income');
    expect(await screen.findByText('Monthly in-hand')).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Salary history' })).toBeInTheDocument();
    income.unmount();

    renderApp('/investments/analysis?scope=year&at=2026');
    expect(await screen.findByRole('heading', { name: '2026' })).toBeInTheDocument();
    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: /^Money out: Spending/ })).toHaveAccessibleName(
      /Debt repaid/,
    );
    expect(screen.getByRole('button', { name: 'Next year' })).toBeDisabled();
  });

  it('records a due recurring payment from the Recurring screen', async () => {
    const user = userEvent.setup();
    await loadSampleFinance();
    const before = (await getFinanceData()).entries.length;
    renderApp('/investments/recurring');
    const due = await screen.findByRole('region', { name: 'Due now' });
    await user.click(within(due).getByRole('button', { name: 'Record Gym membership' }));
    const dialog = screen.getByRole('dialog', { name: 'Record payment' });
    await user.click(within(dialog).getByRole('button', { name: /Record/ }));
    expect(await screen.findByText('Payment recorded')).toBeInTheDocument();
    const data = await getFinanceData();
    expect(data.entries).toHaveLength(before + 1);
    expect(data.entries.find((e) => e.note === 'Gym membership')?.date).toBe('2026-10-01');
  });

  it('searches and filters transactions', async () => {
    await loadSampleFinance();
    renderApp('/investments/activity?q=rent&kind=expense');
    const rows = await screen.findAllByRole('button', { name: /^House rent, Expense, Rent/ });
    expect(rows.length).toBeGreaterThan(0);
    expect(screen.queryByRole('button', { name: /Monthly SIP/ })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Expenses' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });
});

describe('Money across the app', () => {
  it('shows this month’s money on Today and records income from a quick action', async () => {
    const user = userEvent.setup();
    renderApp('/');
    const money = await screen.findByRole('region', { name: 'Money' });
    await user.click(await within(money).findByRole('button', { name: 'Add Income' }));

    const dialog = screen.getByRole('dialog', { name: 'Add transaction' });
    expect(within(dialog).getByRole('button', { name: 'Income' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await user.type(within(dialog).getByLabelText('Amount (₹)'), '50000');
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('Income recorded')).toBeInTheDocument();
    // Compact output differs across Node versions (₹50K on Node 24, ₹50.0K on Node 22), so the
    // expectation comes from the same formatter the UI uses.
    const income = formatINR(50_000 * PAISE_PER_RUPEE, { compact: true });
    expect((await within(money).findAllByText(income)).length).toBeGreaterThan(0);
    expect(within(money).getByRole('link', { name: 'Investments' })).toHaveAttribute(
      'href',
      '/investments',
    );
  });

  it('captures an expense from quick capture', async () => {
    const user = userEvent.setup();
    renderApp('/');
    await user.click(
      await screen.findByRole('button', { name: 'Capture a note, task, or expense' }),
    );
    const dialog = screen.getByRole('dialog', { name: 'Quick capture' });
    await user.click(within(dialog).getByRole('button', { name: 'Expense' }));
    await user.type(within(dialog).getByLabelText('Amount (₹)'), '240');
    await user.selectOptions(within(dialog).getByLabelText('Category'), 'cafe');
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('Expense recorded')).toBeInTheDocument();
    const { entries } = await getFinanceData();
    expect(entries).toEqual([
      expect.objectContaining({ kind: 'expense', amount: 24_000, category: 'cafe' }),
    ]);
  });

  it('shows money insights next to habits, or on their own', async () => {
    await loadSampleFinance();
    await createHabit({ name: 'Read', category: 'reading', frequency: 'daily' });
    const both = renderApp('/insights?period=month');
    expect(await screen.findByRole('region', { name: 'Spending patterns' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Habits & money' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Money, this month' })).toBeInTheDocument();
    both.unmount();

    renderApp('/insights?period=month&view=money');
    expect(await screen.findByRole('region', { name: 'Spending patterns' })).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Habits & money' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Money' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('adds a money report and a money reflection to reviews', async () => {
    await loadSampleFinance();
    renderApp('/review/monthly/2026-09-01');
    const report = await screen.findByRole('region', { name: 'Money' });
    expect(within(report).getByText('Spent')).toBeInTheDocument();
    expect(within(report).getByText('Where it went')).toBeInTheDocument();
    expect(
      await screen.findByLabelText('Money this month: what went well, and what to change'),
    ).toBeInTheDocument();
  });
});
