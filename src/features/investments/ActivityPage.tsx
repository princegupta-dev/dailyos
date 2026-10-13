import { ReceiptIndianRupee, Search, SearchX, SlidersHorizontal, X } from 'lucide-react';
import { useSearchParams } from 'react-router';
import { EmptyState } from '@/components/EmptyState';
import { SelectField, TextField } from '@/components/form';
import { ENTRY_KINDS, type EntryKind } from '@/domain/finance';
import { formatINR } from '@/lib/money';
import { filterEntries } from '@/services/finance.service';
import { plural } from '../reviews/format';
import { EntryList } from './FinanceCards';
import { useFinance } from './financeContext';
import { accountOptions, budgetCategoryOptions, categoryOptions, KIND_PLURALS } from './financeUi';

function isKind(value: string | null): value is EntryKind {
  return ENTRY_KINDS.some((k) => k === value);
}

/**
 * Every transaction: search, filter by type, category (or whole group), account, and month,
 * and edit any of them.
 */
export function ActivityPage() {
  const { data, open } = useFinance();
  const [params, setParams] = useSearchParams();
  const q = params.get('q') ?? '';
  const rawKind = params.get('kind');
  const kind = isKind(rawKind) ? rawKind : undefined;
  const category = params.get('category') ?? '';
  const month = params.get('month') ?? '';
  const account = params.get('account') ?? '';
  const advanced = [category, month, account].filter(Boolean).length;

  const setParam = (key: string, value: string) => {
    setParams(
      (current) => {
        const next = new URLSearchParams(current);
        if (value === '') next.delete(key);
        else next.set(key, value);
        // A category belongs to one kind; switching kinds clears it.
        if (key === 'kind') next.delete('category');
        return next;
      },
      { replace: true },
    );
  };

  if (data.entries.length === 0) {
    return (
      <div className="finance-stack">
        <EmptyState
          icon={ReceiptIndianRupee}
          title="No transactions yet"
          description="Add income, expenses, investments, and savings with the Add button above."
        />
      </div>
    );
  }

  const results = filterEntries(
    data.entries,
    {
      text: q,
      kind,
      category: category || undefined,
      month: month || undefined,
      accountId: account || undefined,
    },
    data,
  );
  // Cash in (income, withdrawals) and out (spending, saving, investing). Transfers stay out.
  const flow = { in: 0, out: 0 };
  for (const e of results) {
    if (e.kind === 'transfer') continue;
    if (e.kind === 'income' || e.withdrawal) flow.in += e.amount;
    else flow.out += e.amount;
  }

  return (
    <div className="finance-stack">
      <div className="search-bar" role="search">
        <Search className="search-bar__icon" size={18} aria-hidden="true" />
        <label className="visually-hidden" htmlFor="finance-search">
          Search transactions
        </label>
        <input
          id="finance-search"
          type="search"
          className="input search-bar__input"
          placeholder="Search notes, categories, amounts…"
          value={q}
          onChange={(e) => {
            setParam('q', e.target.value);
          }}
        />
        {q && (
          <button
            type="button"
            className="search-bar__clear"
            aria-label="Clear search"
            onClick={() => {
              setParam('q', '');
            }}
          >
            <X size={16} aria-hidden="true" />
          </button>
        )}
      </div>

      <div className="topic-chips" role="group" aria-label="Filter by type">
        <button
          type="button"
          className="topic-chip"
          aria-pressed={kind === undefined}
          onClick={() => {
            setParam('kind', '');
          }}
        >
          All
        </button>
        {ENTRY_KINDS.map((k) => (
          <button
            key={k}
            type="button"
            className="topic-chip"
            aria-pressed={kind === k}
            onClick={() => {
              setParam('kind', kind === k ? '' : k);
            }}
          >
            {KIND_PLURALS[k]}
          </button>
        ))}
      </div>

      <details className="disclosure filters" open={advanced > 0}>
        <summary className="disclosure__summary">
          <SlidersHorizontal size={16} aria-hidden="true" />
          Filters
          {advanced > 0 && <span className="tag">{advanced}</span>}
        </summary>
        <div className="disclosure__body filters__grid">
          {kind && kind !== 'transfer' ? (
            <SelectField
              label="Category"
              value={category}
              options={[
                { value: '', label: 'Any category' },
                ...(kind === 'expense'
                  ? budgetCategoryOptions(data.categories).slice(1)
                  : categoryOptions(kind, data.categories)),
              ]}
              onChange={(e) => {
                setParam('category', e.target.value);
              }}
            />
          ) : (
            <p className="field__hint">Choose a type above to filter by category.</p>
          )}
          {data.accounts.length > 0 && (
            <SelectField
              label="Account"
              value={account}
              options={accountOptions(data.accounts, ['cash', 'investment', 'liability'], {
                selected: account,
                none: 'Any account',
              })}
              onChange={(e) => {
                setParam('account', e.target.value);
              }}
            />
          )}
          <TextField
            label="Month"
            type="month"
            value={month}
            onChange={(e) => {
              setParam('month', e.target.value);
            }}
          />
          {advanced > 0 && (
            <button
              type="button"
              className="button button--secondary button--compact"
              onClick={() => {
                setParams(
                  (current) => {
                    const next = new URLSearchParams(current);
                    next.delete('category');
                    next.delete('account');
                    next.delete('month');
                    return next;
                  },
                  { replace: true },
                );
              }}
            >
              Clear filters
            </button>
          )}
        </div>
      </details>

      <div className="activity-summary" aria-live="polite">
        <span>{plural(results.length, 'transaction')}</span>
        {results.length > 0 && (
          <>
            <span className="activity-summary__in">In {formatINR(flow.in)}</span>
            <span>Out {formatINR(flow.out)}</span>
          </>
        )}
      </div>

      {results.length === 0 ? (
        <EmptyState
          icon={SearchX}
          title="No matching transactions"
          description="Try other words, or clear a filter."
        />
      ) : (
        <EntryList entries={results} data={data} open={open} groupByDate />
      )}
    </div>
  );
}
