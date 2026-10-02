import { describe, expect, it } from 'vitest';
import {
  parsePeriod,
  periodContaining,
  periodLabel,
  reviewDraftSchema,
  shiftPeriod,
} from '@/domain/review';

describe('review periods', () => {
  it('computes daily, weekly (Mon/Sun), and monthly periods', () => {
    expect(periodContaining('daily', '2026-10-02', 1)).toEqual({
      type: 'daily',
      start: '2026-10-02',
      end: '2026-10-02',
    });
    expect(periodContaining('weekly', '2026-10-02', 1)).toEqual({
      type: 'weekly',
      start: '2026-09-28',
      end: '2026-10-04',
    });
    expect(periodContaining('weekly', '2026-10-02', 0)).toEqual({
      type: 'weekly',
      start: '2026-09-27',
      end: '2026-10-03',
    });
    expect(periodContaining('monthly', '2026-02-14', 1)).toEqual({
      type: 'monthly',
      start: '2026-02-01',
      end: '2026-02-28',
    });
  });

  it('shifts periods across month and year boundaries', () => {
    expect(shiftPeriod(periodContaining('monthly', '2026-12-10', 1), 1, 1).start).toBe(
      '2027-01-01',
    );
    expect(shiftPeriod(periodContaining('weekly', '2026-12-30', 1), 1, 1).start).toBe('2027-01-04');
    expect(shiftPeriod(periodContaining('daily', '2026-03-01', 1), -1, 1).start).toBe('2026-02-28');
  });

  it('normalizes route params to the real period start and rejects junk', () => {
    expect(parsePeriod('weekly', '2026-10-02', 1)?.start).toBe('2026-09-28');
    expect(parsePeriod('monthly', '2026-10-17', 1)?.start).toBe('2026-10-01');
    expect(parsePeriod('yearly', '2026-10-02', 1)).toBeUndefined();
    expect(parsePeriod('daily', '2026-13-01', 1)).toBeUndefined();
  });

  it('labels periods for display', () => {
    expect(periodLabel(periodContaining('weekly', '2026-10-02', 1), 'en-US')).toBe(
      'Week of September 28',
    );
    expect(periodLabel(periodContaining('monthly', '2026-10-02', 1), 'en-US')).toBe('October 2026');
  });
});

describe('review drafts', () => {
  it('drops blank actions and validates ratings', () => {
    const draft = reviewDraftSchema.parse({
      actions: [{ title: '  ' }, { title: 'Book dentist' }],
    });
    expect(draft.actions).toEqual([{ title: 'Book dentist', status: 'open' }]);
    expect(reviewDraftSchema.safeParse({ rating: 6 }).success).toBe(false);
  });
});
