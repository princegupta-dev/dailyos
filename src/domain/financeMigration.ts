import { addDays } from '@/lib/dates';
import type { Account, AccountType, FinanceEntry } from './finance';

/*
 * Schema 8 replaced investment "holdings" with accounts, linked entries to accounts instead of
 * holdings, and split expense categories into groups with subcategories. These pure functions
 * upgrade older records. The database migration (db/schema.ts) and restoring an older backup
 * (domain/backup.ts) both use them, so both paths produce exactly the same records.
 */

/** Expense categories from before schema 8 that were renamed. The rest kept their keys. */
const LEGACY_EXPENSE_CATEGORIES: Record<string, string> = {
  transport: 'transport_other',
  food: 'dining_out',
  bills: 'bills_other',
  healthcare: 'medical',
};

/** Holding types from before schema 8, as account types. */
const LEGACY_HOLDING_TYPES: Record<string, AccountType> = {
  mutual_fund: 'mutual_fund',
  stock: 'stock',
  fixed_deposit: 'fixed_deposit',
  gold: 'gold_digital',
  other: 'other_investment',
};

export interface LegacyHolding {
  id: string;
  name: string;
  type: string;
  currentValue?: number;
  valuedOn?: string;
  note?: string;
  createdAt: string;
  updatedAt: string;
}

export type LegacyEntry = Omit<FinanceEntry, 'accountId' | 'toAccountId'> & {
  holdingId?: string;
  accountId?: string;
  toAccountId?: string;
};

export function upgradeExpenseCategory(category: string): string {
  return LEGACY_EXPENSE_CATEGORIES[category] ?? category;
}

export function upgradeEntry(entry: LegacyEntry): FinanceEntry {
  const { holdingId, ...rest } = entry;
  const category =
    rest.kind === 'expense'
      ? upgradeExpenseCategory(rest.category)
      : rest.kind === 'investment'
        ? (LEGACY_HOLDING_TYPES[rest.category] ?? rest.category)
        : rest.category;
  const upgraded: FinanceEntry = { ...rest, category };
  if (holdingId !== undefined) {
    // A contribution went into the holding; a withdrawal came out of it.
    if (rest.withdrawal) upgraded.accountId = holdingId;
    else upgraded.toAccountId = holdingId;
  }
  return upgraded;
}

/**
 * A holding as an investment account, keeping its id so entries stay linked. A holding with
 * a market value becomes an account valued on that date, with the money contributed up to
 * then as its cost; one without starts empty just before its first contribution, so its
 * contributions add up to its value at cost, exactly as before.
 */
export function holdingToAccount(holding: LegacyHolding, entries: readonly LegacyEntry[]): Account {
  const own = entries.filter((e) => e.holdingId === holding.id);
  const net = (rows: readonly LegacyEntry[]) =>
    rows.reduce((sum, e) => sum + (e.withdrawal ? -e.amount : e.amount), 0);
  const base = {
    id: holding.id,
    name: holding.name,
    type: LEGACY_HOLDING_TYPES[holding.type] ?? 'other_investment',
    ...(holding.note === undefined ? {} : { note: holding.note }),
    createdAt: holding.createdAt,
    updatedAt: holding.updatedAt,
  };

  if (holding.currentValue !== undefined && holding.valuedOn !== undefined) {
    const valuedOn = holding.valuedOn;
    const before = own.filter((e) => e.date <= valuedOn);
    // Everything dated up to the valuation is already in the value, whenever it was recorded.
    const balanceSetAt = before.reduce(
      (latest, e) => (e.createdAt > latest ? e.createdAt : latest),
      holding.updatedAt,
    );
    return {
      ...base,
      balance: holding.currentValue,
      asOf: valuedOn,
      balanceSetAt,
      invested: Math.max(net(before), 0),
      valuedOn,
    };
  }

  const earliest = own.reduce(
    (min, e) => (e.date < min ? e.date : min),
    holding.createdAt.slice(0, 10),
  );
  return {
    ...base,
    balance: 0,
    asOf: addDays(earliest, -1),
    balanceSetAt: holding.createdAt,
    invested: 0,
  };
}
