import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getPlan, updatePlanDetails } from '@/db/repositories/plans';
import { resetDatabase, setNow } from '../helpers/db';

beforeEach(async () => {
  await resetDatabase('America/New_York');
  setNow('2026-10-02T14:00:00Z'); // 10:00 in New York
});

afterEach(() => {
  vi.useRealTimers();
});

describe('daily intention and outcomes', () => {
  it('creates the plan on first edit with the active time zone', async () => {
    const plan = await updatePlanDetails('2026-10-02', { intention: '  Deep work before noon  ' });
    expect(plan).toMatchObject({
      date: '2026-10-02',
      timezone: 'America/New_York',
      intention: 'Deep work before noon',
    });
  });

  it('stores up to three outcomes, drops blanks, and keeps ids stable', async () => {
    const first = await updatePlanDetails('2026-10-02', {
      topOutcomes: [
        { text: 'Ship release', done: false },
        { text: '   ', done: false },
        { text: 'Call Sam', done: false },
      ],
    });
    expect(first.topOutcomes.map((o) => o.text)).toEqual(['Ship release', 'Call Sam']);

    const [ship, call] = first.topOutcomes;
    const second = await updatePlanDetails('2026-10-02', {
      topOutcomes: [{ ...ship!, done: true }, { ...call! }],
    });
    expect(second.topOutcomes[0]).toEqual({ id: ship!.id, text: 'Ship release', done: true });

    await expect(
      updatePlanDetails('2026-10-02', {
        topOutcomes: ['a', 'b', 'c', 'd'].map((text) => ({ text, done: false })),
      }),
    ).rejects.toMatchObject({ kind: 'validation' });
    expect((await getPlan('2026-10-02'))?.topOutcomes).toHaveLength(2);
  });

  it('allows yesterday (late-night reflection) but not older plans', async () => {
    setNow('2026-10-03T04:30:00Z'); // 00:30 on Oct 3 in New York
    await expect(updatePlanDetails('2026-10-02', { intention: 'x' })).resolves.toBeDefined();
    await expect(updatePlanDetails('2026-10-01', { intention: 'x' })).rejects.toMatchObject({
      kind: 'invalid_operation',
    });
  });
});
