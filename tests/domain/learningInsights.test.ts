import { describe, expect, it } from 'vitest';
import {
  capturesByWeek,
  reviewProgress,
  topicCounts,
  topicTone,
} from '@/features/learning/learningInsights';

describe('learning insights', () => {
  it('gives a topic the same tone regardless of case', () => {
    expect(topicTone('TypeScript')).toBe(topicTone('typescript'));
    expect(topicTone(undefined)).toBe('sage');
  });

  it('counts topics, most used first', () => {
    const entries = [{ topic: 'B' }, { topic: 'A' }, { topic: 'B' }, {}] as never[];
    expect(topicCounts(entries)).toEqual([
      { topic: 'B', count: 2 },
      { topic: 'A', count: 1 },
    ]);
  });

  it('counts completed reviews', () => {
    expect(
      reviewProgress({
        reviewDates: [
          { date: '2026-10-01', completedAt: '2026-10-01T09:00:00Z' },
          { date: '2026-10-08' },
        ],
      }),
    ).toEqual({ done: 1, total: 2 });
  });

  it('buckets captures into weeks ending with this one', () => {
    // 2026-10-05 is a Monday.
    const weeks = capturesByWeek(
      [
        { capturedDate: '2026-10-05' },
        { capturedDate: '2026-10-04' },
        { capturedDate: '2026-09-28' },
      ],
      '2026-10-06',
      1,
      3,
    );
    expect(weeks).toEqual([
      { start: '2026-09-21', count: 0 },
      { start: '2026-09-28', count: 2 },
      { start: '2026-10-05', count: 1 },
    ]);
  });
});
