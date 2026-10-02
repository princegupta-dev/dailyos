import { describe, expect, it } from 'vitest';
import { formatDateKey, isDateKey, toLocalDateKey } from '@/lib/dates';

describe('toLocalDateKey', () => {
  it('returns the calendar date observed in the given time zone', () => {
    const instant = new Date('2026-10-02T23:30:00Z');
    expect(toLocalDateKey(instant, 'UTC')).toBe('2026-10-02');
    expect(toLocalDateKey(instant, 'America/Los_Angeles')).toBe('2026-10-02');
    expect(toLocalDateKey(instant, 'Asia/Kolkata')).toBe('2026-10-03');
  });

  it('handles the instant just before and after local midnight', () => {
    // Asia/Kolkata is UTC+05:30, so local midnight is 18:30Z the previous day.
    expect(toLocalDateKey(new Date('2026-10-02T18:29:59.999Z'), 'Asia/Kolkata')).toBe('2026-10-02');
    expect(toLocalDateKey(new Date('2026-10-02T18:30:00Z'), 'Asia/Kolkata')).toBe('2026-10-03');
  });

  it('handles 23-hour and 25-hour days around DST transitions', () => {
    // US DST starts 2026-03-08 and ends 2026-11-01 in America/New_York.
    expect(toLocalDateKey(new Date('2026-03-08T04:59:00Z'), 'America/New_York')).toBe('2026-03-07');
    expect(toLocalDateKey(new Date('2026-03-08T05:00:00Z'), 'America/New_York')).toBe('2026-03-08');
    expect(toLocalDateKey(new Date('2026-03-09T03:59:00Z'), 'America/New_York')).toBe('2026-03-08');
    expect(toLocalDateKey(new Date('2026-03-09T04:00:00Z'), 'America/New_York')).toBe('2026-03-09');
    expect(toLocalDateKey(new Date('2026-11-02T04:59:00Z'), 'America/New_York')).toBe('2026-11-01');
    expect(toLocalDateKey(new Date('2026-11-02T05:00:00Z'), 'America/New_York')).toBe('2026-11-02');
  });

  it('throws for an unknown time zone', () => {
    expect(() => toLocalDateKey(new Date(), 'Not/A_Zone')).toThrow(RangeError);
  });
});

describe('isDateKey', () => {
  it.each(['2026-10-02', '2024-02-29', '2026-12-31'])('accepts %s', (value) => {
    expect(isDateKey(value)).toBe(true);
  });

  it.each(['2026-02-29', '2026-13-01', '2026-00-10', '2026-10-32', '2026-1-2', '20261002', ''])(
    'rejects %s',
    (value) => {
      expect(isDateKey(value)).toBe(false);
    },
  );
});

describe('formatDateKey', () => {
  it('formats the calendar date without shifting by the runtime time zone', () => {
    expect(formatDateKey('2026-10-02', 'en-US')).toBe('Friday, October 2');
    expect(formatDateKey('2026-01-01', 'en-US')).toBe('Thursday, January 1');
  });

  it('rejects invalid keys', () => {
    expect(() => formatDateKey('2026-02-30', 'en-US')).toThrow(RangeError);
  });
});
