import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useLocalDateKey } from '@/hooks/useLocalDateKey';

describe('useLocalDateKey', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('rolls over to the next date after local midnight while the app stays open', () => {
    let current = new Date('2026-10-02T18:29:00Z'); // 23:59 in Asia/Kolkata
    const now = () => current;

    const { result } = renderHook(() => useLocalDateKey('Asia/Kolkata', now));
    expect(result.current).toBe('2026-10-02');

    current = new Date('2026-10-02T18:30:30Z'); // 00:00:30 the next day
    act(() => {
      vi.advanceTimersByTime(60_000);
    });
    expect(result.current).toBe('2026-10-03');
  });

  it('refreshes when the page becomes visible again', () => {
    let current = new Date('2026-10-02T12:00:00Z');
    const now = () => current;
    const { result } = renderHook(() => useLocalDateKey('UTC', now));

    current = new Date('2026-10-03T08:00:00Z');
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect(result.current).toBe('2026-10-03');
  });
});
