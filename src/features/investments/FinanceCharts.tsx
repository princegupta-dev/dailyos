import { useState } from 'react';
import { formatINR } from '@/lib/money';
import type {
  CategoryAmount,
  CumulativePoint,
  GroupAmount,
  MonthTotals,
} from '@/services/finance.service';
import { percent } from '../reviews/format';
import { monthName, shortMonthName } from './financeUi';

/*
 * Small, dependency-free charts in the style of Insights. Every chart has a text alternative
 * (aria-label or visible values), and the interactive ones are buttons, so hovering,
 * tapping, and keyboard focus all reveal the same details.
 */

/* ---------- Meter ---------- */

export type MeterTone = 'ok' | 'near' | 'over' | 'done';

interface MeterProps {
  /** 0–1; values above 1 fill the bar. */
  fraction: number;
  tone?: MeterTone;
  label: string;
  /** Optional marker, 0–1, e.g. how much of the year has passed. */
  marker?: number | undefined;
}

/** A thin progress bar. Its tone is always paired with text nearby, never color alone. */
export function Meter({ fraction, tone = 'ok', label, marker }: MeterProps) {
  return (
    <span className={`meter meter--${tone}`} role="img" aria-label={label}>
      <span style={{ inlineSize: `${Math.min(Math.max(fraction, 0), 1) * 100}%` }} />
      {marker !== undefined && marker > 0 && marker < 1 && (
        <i className="meter__marker" style={{ insetInlineStart: `${marker * 100}%` }} />
      )}
    </span>
  );
}

/* ---------- Income vs. expenses ---------- */

/** Income beside expenses for each month. Choosing a month shows its full breakdown. */
export function CashflowChart({ months }: { months: readonly MonthTotals[] }) {
  const [selected, setSelected] = useState(months.length - 1);
  const index = Math.min(selected, months.length - 1);
  const month = months[index];
  const max = Math.max(1, ...months.flatMap((m) => [m.totals.income, m.totals.expenses]));
  const hasData = months.some((m) => m.totals.income > 0 || m.totals.expenses > 0);

  if (!hasData) {
    return <p className="quiet-note">Record income and expenses to compare them month by month.</p>;
  }

  return (
    <div className="cashflow">
      <p className="chart-legend" aria-hidden="true">
        <span className="chart-legend__key" style={{ background: 'var(--series-1)' }} /> Income
        <span className="chart-legend__key" style={{ background: 'var(--series-2)' }} /> Expenses
      </p>
      <div className="cashflow__plot" role="group" aria-label="Months">
        {months.map((m, i) => {
          const label = `${monthName(m.month)}: income ${formatINR(m.totals.income)}, expenses ${formatINR(m.totals.expenses)}`;
          return (
            <button
              key={m.month}
              type="button"
              className="cashflow__month"
              aria-pressed={i === index}
              aria-label={label}
              title={label}
              onClick={() => {
                setSelected(i);
              }}
              onMouseEnter={() => {
                setSelected(i);
              }}
            >
              <span className="cashflow__bars" aria-hidden="true">
                <span
                  className="cashflow__bar"
                  style={{
                    blockSize: `${(m.totals.income / max) * 100}%`,
                    background: 'var(--series-1)',
                  }}
                />
                <span
                  className="cashflow__bar"
                  style={{
                    blockSize: `${(m.totals.expenses / max) * 100}%`,
                    background: 'var(--series-2)',
                  }}
                />
              </span>
              <span className="cashflow__label" aria-hidden="true">
                {shortMonthName(m.month)}
              </span>
            </button>
          );
        })}
      </div>
      {month && (
        <div className="chart-detail" aria-live="polite">
          <p className="chart-detail__title">{monthName(month.month)}</p>
          <dl className="chart-detail__stats">
            <div>
              <dt>Income</dt>
              <dd>{formatINR(month.totals.income)}</dd>
            </div>
            <div>
              <dt>Expenses</dt>
              <dd>{formatINR(month.totals.expenses)}</dd>
            </div>
            <div>
              <dt>Invested</dt>
              <dd>{formatINR(month.totals.invested)}</dd>
            </div>
            <div>
              <dt>Saved</dt>
              <dd>{formatINR(month.totals.saved)}</dd>
            </div>
            <div>
              <dt>Savings rate</dt>
              <dd>{percent(month.totals.savingsRate)}</dd>
            </div>
          </dl>
        </div>
      )}
    </div>
  );
}

/* ---------- Category breakdown ---------- */

interface BreakdownProps {
  items: readonly CategoryAmount[];
  /** Rows shown before the rest fold into "Everything else". */
  limit?: number;
  empty: string;
  /** Leave out each row's share, e.g. when rows are months rather than parts of a whole. */
  hideShare?: boolean;
}

/**
 * Horizontal bars, largest first. One hue: the bars compare sizes of the same measure, and
 * every row is labeled with its amount and share.
 */
export function BreakdownBars({ items, limit = 6, empty, hideShare = false }: BreakdownProps) {
  if (items.length === 0) return <p className="quiet-note">{empty}</p>;
  const shown = items.slice(0, limit);
  const rest = items.slice(limit);
  const rows =
    rest.length === 0
      ? shown
      : [
          ...shown,
          {
            category: '__rest__',
            label: 'Everything else',
            amount: rest.reduce((sum, r) => sum + r.amount, 0),
            share: rest.reduce((sum, r) => sum + r.share, 0),
          },
        ];
  const max = Math.max(1, ...rows.map((r) => r.amount));
  return (
    <ul className="breakdown">
      {rows.map((row) => (
        <li key={row.category} className="breakdown__row">
          <span className="breakdown__label">{row.label}</span>
          <span className="breakdown__value">
            {formatINR(row.amount)}
            {!hideShare && <span className="breakdown__share">{percent(row.share)}</span>}
          </span>
          <span className="breakdown__track" aria-hidden="true">
            <span style={{ inlineSize: `${Math.max((row.amount / max) * 100, 1)}%` }} />
          </span>
        </li>
      ))}
    </ul>
  );
}

/* ---------- Allocation ---------- */

export interface AllocationPart {
  key: string;
  label: string;
  value: number;
  share: number;
  color: string;
}

/** One stacked bar of parts, with a legend that names every part with its value. */
export function AllocationBar({
  parts,
  label,
}: {
  parts: readonly AllocationPart[];
  label: string;
}) {
  if (parts.length === 0) return null;
  return (
    <div className="allocation">
      <div
        className="allocation__bar"
        role="img"
        aria-label={`${label}: ${parts.map((p) => `${p.label} ${percent(p.share)}`).join(', ')}`}
      >
        {parts.map((p) => (
          <span key={p.key} style={{ flexGrow: p.value, background: p.color }} />
        ))}
      </div>
      <ul className="allocation__legend">
        {parts.map((p) => (
          <li key={p.key}>
            <span
              className="chart-legend__key"
              style={{ background: p.color }}
              aria-hidden="true"
            />
            <span className="allocation__name">{p.label}</span>
            <span className="allocation__value">
              {formatINR(p.value, { compact: true })} · {percent(p.share)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ---------- Wealth trend ---------- */

const W = 600;
const H = 180;
const PAD_X = 12;
const PAD_Y = 16;

/**
 * Savings plus investments put away (net), as a running total by month. Hover, tap, or
 * focus a month to read its value.
 */
export function WealthTrend({ points }: { points: readonly CumulativePoint[] }) {
  const [selected, setSelected] = useState(points.length - 1);
  if (points.length === 0 || points.every((p) => p.total === 0 && p.added === 0)) {
    return (
      <p className="quiet-note">Record savings or investments to see your wealth grow here.</p>
    );
  }
  const values = points.map((p) => p.total);
  const low = Math.min(0, ...values);
  const high = Math.max(1, ...values);
  const x = (i: number) =>
    points.length === 1 ? W / 2 : PAD_X + (i * (W - 2 * PAD_X)) / (points.length - 1);
  const y = (v: number) => H - PAD_Y - ((v - low) / (high - low)) * (H - 2 * PAD_Y);
  const line = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i)},${y(p.total)}`).join(' ');
  const area = `${line} L${x(points.length - 1)},${y(low)} L${x(0)},${y(low)} Z`;
  const index = Math.min(selected, points.length - 1);
  const point = points[index];

  return (
    <div className="wealth">
      <div className="wealth__plot">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="wealth__svg"
          aria-hidden="true"
          preserveAspectRatio="none"
        >
          <path d={area} className="wealth__area" />
          <path d={line} className="wealth__line" vectorEffect="non-scaling-stroke" />
          {point && (
            <line
              x1={x(index)}
              x2={x(index)}
              y1={PAD_Y / 2}
              y2={H - PAD_Y / 2}
              className="wealth__crosshair"
              vectorEffect="non-scaling-stroke"
            />
          )}
        </svg>
        {point && (
          <span
            className="wealth__dot"
            style={{
              insetInlineStart: `${(x(index) / W) * 100}%`,
              insetBlockStart: `${(y(point.total) / H) * 100}%`,
            }}
            aria-hidden="true"
          />
        )}
        <div className="wealth__hits" role="group" aria-label="Months">
          {points.map((p, i) => (
            <button
              key={p.month}
              type="button"
              className="wealth__hit"
              aria-pressed={i === index}
              aria-label={`${monthName(p.month)}: ${formatINR(p.total)} put away in total`}
              onClick={() => {
                setSelected(i);
              }}
              onMouseEnter={() => {
                setSelected(i);
              }}
              onFocus={() => {
                setSelected(i);
              }}
            />
          ))}
        </div>
      </div>
      <div className="wealth__axis" aria-hidden="true">
        <span>{points[0] ? shortMonthName(points[0].month) : ''}</span>
        <span>{shortMonthName(points.at(-1)?.month ?? '')}</span>
      </div>
      {point && (
        <p className="chart-detail__line" aria-live="polite">
          <strong>{monthName(point.month)}</strong> · {formatINR(point.total)} in total ·{' '}
          {formatINR(point.added, { signed: true })} that month
        </p>
      )}
    </div>
  );
}

/* ---------- Spending by group ---------- */

/**
 * Spending by group (Home, Food…), largest first; open a group to see its subcategories.
 * One hue throughout: the bars compare amounts, and every row carries its numbers.
 */
export function GroupBreakdown({
  groups,
  empty,
}: {
  groups: readonly GroupAmount[];
  empty: string;
}) {
  if (groups.length === 0) return <p className="quiet-note">{empty}</p>;
  const max = Math.max(1, ...groups.map((g) => g.amount));
  return (
    <ul className="breakdown group-breakdown">
      {groups.map((g) => (
        <li key={g.category}>
          <details className="group-breakdown__group">
            <summary className="breakdown__row group-breakdown__summary">
              <span className="breakdown__label">{g.label}</span>
              <span className="breakdown__value">
                {formatINR(g.amount)}
                <span className="breakdown__share">{percent(g.share)}</span>
              </span>
              <span className="breakdown__track" aria-hidden="true">
                <span style={{ inlineSize: `${Math.max((g.amount / max) * 100, 1)}%` }} />
              </span>
            </summary>
            <ul className="group-breakdown__items">
              {g.items.map((item) => (
                <li key={item.category}>
                  <span>{item.label}</span>
                  <span className="group-breakdown__amount">{formatINR(item.amount)}</span>
                </li>
              ))}
            </ul>
          </details>
        </li>
      ))}
    </ul>
  );
}
