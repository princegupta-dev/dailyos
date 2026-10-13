import type {
  Account,
  AccountType,
  Budget,
  FinanceEntry,
  FinanceGoal,
  RecurringFrequency,
  RecurringRule,
  SalaryRecord,
  SavingsPot,
} from '@/domain/finance';
import { addDays, addMonths, endOfMonth } from '@/lib/dates';
import { PAISE_PER_RUPEE } from '@/lib/money';
import { accountSummaries, nextOccurrence } from './finance.service';

/*
 * Example data for exploring the Expense Tracker before entering real numbers. Only ever
 * written on request into an empty finance section (see loadSampleFinance). Every date is
 * relative to today, so the sample always looks current. Names are generic, not real banks.
 */

const SAMPLE_MONTHS = 6;
const rupees = (value: number) => Math.round(value * PAISE_PER_RUPEE);

export interface SampleFinance {
  salaries: SalaryRecord[];
  accounts: Account[];
  entries: FinanceEntry[];
  budgets: Budget[];
  goals: FinanceGoal[];
  recurring: RecurringRule[];
}

type EntryInput = Omit<FinanceEntry, 'id' | 'createdAt' | 'updatedAt' | 'amount'> & {
  amount: number;
};

export function buildSampleFinance(today: string, now: string, newId: () => string): SampleFinance {
  const stamp = { createdAt: now, updatedAt: now };
  const thisMonth = `${today.slice(0, 7)}-01`;
  const firstMonth = addMonths(thisMonth, -(SAMPLE_MONTHS - 1));
  const opening = addDays(firstMonth, -1);

  /* Accounts, with balances as of the day before the sample starts. */
  const account = (
    name: string,
    type: AccountType,
    balance: number,
    extra: Partial<Account> = {},
  ): Account => ({
    id: newId(),
    name,
    type,
    balance: rupees(balance),
    asOf: opening,
    balanceSetAt: now,
    ...stamp,
    ...extra,
  });
  const bank = account('Salary account', 'bank_savings', 40_000, {
    institution: 'City Bank',
    identifier: '4821',
  });
  const cash = account('Cash in hand', 'cash', 2_000);
  const emergency = account('Emergency fund', 'bank_savings', 20_000, {
    institution: 'City Bank',
    savingsPot: 'emergency',
  });
  const kitty = account('Travel kitty', 'kitty', 0, { savingsPot: 'general' });
  const card = account('Rewards credit card', 'credit_card', 0, { institution: 'City Bank' });
  const loan = account('Two-wheeler loan', 'loan', 60_000, { institution: 'Metro Finance' });
  const invest = (name: string, type: AccountType, platform: string) =>
    account(name, type, 0, { institution: platform, invested: 0 });
  const nifty = invest('Nifty 50 index SIP', 'sip', 'Fund app');
  const flexi = invest('Flexi cap fund', 'mutual_fund', 'Fund app');
  const stocks = invest('Stocks & ETFs', 'stock', 'Broker app');
  const fd = invest('1-year FD', 'fixed_deposit', 'City Bank');
  const gold = invest('Digital gold', 'gold_digital', 'Gold app');
  const ppf = invest('PPF', 'ppf', 'Post office');

  /* Recurring payments, anchored in the first sample month. */
  const rules: RecurringRule[] = [];
  const rule = (
    day: number,
    entry: Omit<EntryInput, 'date'>,
    frequency: RecurringFrequency = 'monthly',
    extra: Partial<RecurringRule> = {},
  ): RecurringRule => {
    const startDate = `${firstMonth.slice(0, 8)}${String(day).padStart(2, '0')}`;
    const r: RecurringRule = {
      id: newId(),
      ...entry,
      amount: rupees(entry.amount),
      frequency,
      startDate,
      nextDue: startDate,
      ...stamp,
      ...extra,
    };
    rules.push(r);
    return r;
  };
  const rent = rule(3, {
    kind: 'expense',
    category: 'rent',
    accountId: bank.id,
    amount: 22_000,
    note: 'House rent',
  });
  const parents = rule(2, {
    kind: 'expense',
    category: 'parents_support',
    accountId: bank.id,
    amount: 10_000,
    note: 'For Maa & Papa',
  });
  const sip = rule(5, {
    kind: 'investment',
    category: 'sip',
    accountId: bank.id,
    toAccountId: nifty.id,
    amount: 10_000,
    note: 'Monthly SIP',
  });
  const ott = rule(
    7,
    { kind: 'expense', category: 'ott', accountId: card.id, amount: 649, note: 'Streaming plan' },
    'monthly',
    { autopay: true },
  );
  const emi = rule(10, {
    kind: 'transfer',
    category: 'transfer',
    accountId: bank.id,
    toAccountId: loan.id,
    amount: 5_000,
    note: 'Loan EMI (principal)',
  });
  const emiInterest = rule(10, {
    kind: 'expense',
    category: 'loan_interest',
    accountId: bank.id,
    amount: 600,
    note: 'Loan EMI (interest)',
  });
  const toEmergency = rule(2, {
    kind: 'saving',
    category: 'emergency',
    accountId: bank.id,
    toAccountId: emergency.id,
    amount: 6_000,
    note: 'Emergency fund top-up',
  });
  // Set up this month, so it's due now: shows how due payments are recorded.
  const gym = rule(
    1,
    { kind: 'expense', category: 'gym', accountId: card.id, amount: 1_500, note: 'Gym membership' },
    'monthly',
    { autopay: true },
  );

  const entries: FinanceEntry[] = [];
  const add = (entry: EntryInput) => {
    // Nothing in the future: the current month only gets what has happened so far.
    if (entry.date > today) return;
    entries.push({ ...entry, amount: rupees(entry.amount), id: newId(), ...stamp });
  };
  /** Records a recurring payment on its date and moves the schedule along, as the app does. */
  const pay = (r: RecurringRule, date: string, amount?: number) => {
    if (date > today) return;
    add({
      kind: r.kind,
      category: r.category,
      amount: (amount ?? r.amount) / PAISE_PER_RUPEE,
      date,
      ...(r.accountId ? { accountId: r.accountId } : {}),
      ...(r.toAccountId ? { toAccountId: r.toAccountId } : {}),
      ...(r.note ? { note: r.note } : {}),
      recurringId: r.id,
    });
    r.nextDue = nextOccurrence(date, r.frequency, r.startDate);
  };

  for (let m = 0; m < SAMPLE_MONTHS; m++) {
    const month = addMonths(firstMonth, m);
    const day = (d: number) => {
      const last = Number(endOfMonth(month).slice(8));
      return `${month.slice(0, 8)}${String(Math.min(d, last)).padStart(2, '0')}`;
    };
    // A small, repeatable wobble so months differ without randomness.
    const wobble = (base: number, step: number) =>
      Math.round(base + ((m * 37 + step * 11) % 9) * (base / 40));
    const spend = (category: string, amount: number, date: number, from: Account, note: string) => {
      add({ kind: 'expense', category, amount, date: day(date), accountId: from.id, note });
    };

    add({
      kind: 'income',
      category: 'salary',
      amount: m >= 2 ? 86_000 : 78_000,
      date: day(1),
      toAccountId: bank.id,
      note: 'Monthly salary',
    });
    if (m % 2 === 1) {
      add({
        kind: 'income',
        category: 'freelance',
        amount: wobble(12_000, 1),
        date: day(18),
        toAccountId: bank.id,
        note: 'Website project',
      });
    }
    if (m === 3) {
      add({
        kind: 'income',
        category: 'bonus',
        amount: 25_000,
        date: day(25),
        toAccountId: bank.id,
        note: 'Performance bonus',
      });
    }
    add({
      kind: 'income',
      category: 'interest',
      amount: wobble(450, 2),
      date: day(28),
      toAccountId: bank.id,
      note: 'Savings interest',
    });

    pay(parents, day(2));
    pay(toEmergency, day(2));
    pay(rent, day(3));
    pay(sip, day(5));
    pay(ott, day(7));
    pay(emi, day(10));
    pay(emiInterest, day(10), rupees(wobble(600, 3)));

    add({
      kind: 'transfer',
      category: 'transfer',
      amount: 3_000,
      date: day(4),
      accountId: bank.id,
      toAccountId: cash.id,
      note: 'ATM withdrawal',
    });
    spend('electricity', wobble(1_900, 4), 6, bank, 'Electricity bill');
    spend('internet', 799, 6, card, 'Broadband');
    spend('mobile', 299, 8, card, 'Mobile recharge');
    spend('groceries', wobble(3_200, 5), 5, card, 'Weekly groceries');
    spend('groceries', wobble(2_900, 6), 19, card, 'Weekly groceries');
    spend('household_supplies', wobble(900, 7), 12, card, 'Cleaning supplies');
    spend('dining_out', wobble(1_400, 8), 9, card, 'Dinner with friends');
    spend('food_delivery', wobble(900, 9), 22, card, 'Food delivery');
    spend('cafe', wobble(350, 10), 14, cash, 'Coffee');
    spend('snacks', wobble(200, 11), 16, cash, 'Snacks');
    spend('metro', wobble(800, 12), 10, bank, 'Metro card top-up');
    spend('cab', wobble(1_100, 13), 17, card, 'Cabs');
    spend('fuel', wobble(1_200, 14), 13, card, 'Fuel');
    spend('clothing', wobble(2_500, 15), 14, card, 'Clothes');
    spend('personal_care', wobble(700, 16), 20, card, 'Haircut');
    spend('movies', wobble(800, 17), 16, card, 'Movies');
    if (m % 3 === 0) spend('medical', wobble(1_600, 18), 12, card, 'Doctor visit');
    if (m === 2) spend('festivals', 4_000, 20, card, 'Festival shopping');
    if (m === 4) spend('travel', 9_500, 21, card, 'Weekend trip');

    // Paying the card bill is a repayment, not spending: the purchases were already counted.
    if (m > 0) {
      const lastMonth = addMonths(month, -1);
      const bill = entries
        .filter(
          (e) =>
            e.accountId === card.id &&
            e.kind === 'expense' &&
            e.date.startsWith(lastMonth.slice(0, 7)),
        )
        .reduce((sum, e) => sum + e.amount, 0);
      add({
        kind: 'transfer',
        category: 'transfer',
        amount: bill / PAISE_PER_RUPEE,
        date: day(15),
        accountId: bank.id,
        toAccountId: card.id,
        note: 'Credit card bill',
      });
    }

    add({
      kind: 'investment',
      category: 'mutual_fund',
      amount: 5_000,
      date: day(5),
      accountId: bank.id,
      toAccountId: flexi.id,
      note: 'Monthly SIP',
    });
    if (m % 2 === 0) {
      add({
        kind: 'investment',
        category: 'stock',
        amount: wobble(6_000, 19),
        date: day(15),
        accountId: bank.id,
        toAccountId: stocks.id,
      });
    }
    add({
      kind: 'investment',
      category: 'gold_digital',
      amount: 1_000,
      date: day(20),
      accountId: bank.id,
      toAccountId: gold.id,
      note: 'Gold SIP',
    });
    if (m === 1) {
      add({
        kind: 'investment',
        category: 'fixed_deposit',
        amount: 50_000,
        date: day(8),
        accountId: bank.id,
        toAccountId: fd.id,
      });
    }
    if (m % 3 === 1) {
      add({
        kind: 'investment',
        category: 'ppf',
        amount: 5_000,
        date: day(24),
        accountId: bank.id,
        toAccountId: ppf.id,
      });
    }
    add({
      kind: 'saving',
      category: 'general' satisfies SavingsPot,
      amount: wobble(3_000, 20),
      date: day(26),
      accountId: bank.id,
      toAccountId: kitty.id,
      note: 'Travel fund',
    });
    if (m === 4) {
      add({
        kind: 'saving',
        category: 'general',
        amount: 5_000,
        date: day(27),
        accountId: kitty.id,
        toAccountId: bank.id,
        withdrawal: true,
        note: 'Weekend trip',
      });
    }
  }

  // Gym starts this month, so its first payment is due rather than recorded.
  gym.startDate = thisMonth;
  gym.nextDue = thisMonth;

  // Market values today, roughly where the contributions would have grown to.
  const growth = new Map<string, number>([
    [nifty.id, 1.074],
    [flexi.id, 1.091],
    [stocks.id, 0.962],
    [fd.id, 1.035],
    [gold.id, 1.12],
    [ppf.id, 1.03],
  ]);
  const accounts = [
    bank,
    cash,
    emergency,
    kitty,
    card,
    loan,
    nifty,
    flexi,
    stocks,
    fd,
    gold,
    ppf,
  ].map((a) => {
    const factor = growth.get(a.id);
    if (factor === undefined) return a;
    const [summary] = accountSummaries([a], entries, today);
    const invested = summary?.invested ?? 0;
    return {
      ...a,
      balance: Math.round(invested * factor),
      invested,
      asOf: today,
      valuedOn: today,
    };
  });

  const budget = (period: Budget['period'], category: string, limit: number): Budget => ({
    id: newId(),
    period,
    category,
    limit: rupees(limit),
    ...stamp,
  });
  const budgets = [
    budget('monthly', 'all', 60_000),
    budget('monthly', 'group:food', 9_000),
    budget('monthly', 'group:personal', 4_000),
    budget('monthly', 'group:lifestyle', 2_000),
    budget('monthly', 'group:transport', 3_500),
    budget('annual', 'all', 7_00_000),
  ];

  const year = Number(today.slice(0, 4));
  const goal = (name: string, kind: FinanceGoal['kind'], target: number): FinanceGoal => ({
    id: newId(),
    name,
    kind,
    year,
    target: rupees(target),
    deadline: `${year}-12-31`,
    ...stamp,
  });
  const goals = [
    goal('Grow the emergency fund', 'savings', 1_20_000),
    goal('Invest steadily', 'investment', 2_50_000),
    goal('Keep yearly spending in check', 'spending', 7_00_000),
  ];

  const salaries: SalaryRecord[] = [
    {
      id: newId(),
      effectiveFrom: addMonths(firstMonth, -12),
      monthlyGross: rupees(98_000),
      monthlyInHand: rupees(78_000),
      annualCtc: rupees(12_50_000),
      employer: 'Acme Technologies',
      ...stamp,
    },
    {
      id: newId(),
      effectiveFrom: addMonths(firstMonth, 2),
      monthlyGross: rupees(1_08_000),
      monthlyInHand: rupees(86_000),
      annualCtc: rupees(14_00_000),
      employer: 'Acme Technologies',
      note: 'Annual appraisal',
      ...stamp,
    },
  ];

  return { salaries, accounts, entries, budgets, goals, recurring: rules };
}
