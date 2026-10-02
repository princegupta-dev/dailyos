import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { getPlan } from '@/db/repositories/plans';
import { getSettings } from '@/db/repositories/settings';
import { toLocalDateKey } from '@/lib/dates';
import { resetDatabase } from '../helpers/db';
import { renderApp } from '../helpers/render';

const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
const today = () => toLocalDateKey(new Date(), zone);

beforeEach(async () => {
  await resetDatabase(zone);
});

describe('daily intention and outcomes', () => {
  it('saves the intention and outcomes, then ticks an outcome off', async () => {
    const user = userEvent.setup();
    renderApp('/');

    await user.type(await screen.findByLabelText('Today’s intention'), 'Calm, focused, kind');
    await user.type(screen.getByLabelText('Priority 1'), 'Finish chapter draft');
    await user.type(screen.getByLabelText('Priority 2'), 'Run 5k');
    await user.click(screen.getByRole('button', { name: 'Save plan' }));

    expect(await screen.findByText('Plan saved')).toBeInTheDocument();
    await waitFor(async () => {
      expect((await getPlan(today()))?.topOutcomes.map((o) => o.text)).toEqual([
        'Finish chapter draft',
        'Run 5k',
      ]);
    });
    expect((await getPlan(today()))?.intention).toBe('Calm, focused, kind');
    expect(screen.queryByRole('button', { name: 'Save plan' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('checkbox', { name: 'Priority 1 done' }));
    expect(await screen.findByText('1 of 2 done')).toBeInTheDocument();
    expect((await getPlan(today()))?.topOutcomes[0]?.done).toBe(true);
  });

  it('discarding unsaved edits restores the saved plan', async () => {
    const user = userEvent.setup();
    renderApp('/');
    const intention = await screen.findByLabelText('Today’s intention');
    await user.type(intention, 'Draft');
    await user.click(screen.getByRole('button', { name: 'Discard' }));
    expect(intention).toHaveValue('');
    expect(await getPlan(today())).toBeUndefined();
  });
});

describe('date and time settings', () => {
  it('saves the week start and time zone preferences', async () => {
    const user = userEvent.setup();
    renderApp('/settings');
    await user.selectOptions(await screen.findByLabelText('Week starts on'), '0');
    await waitFor(async () => {
      expect((await getSettings()).weekStartsOn).toBe(0);
    });

    await user.selectOptions(screen.getByLabelText('Time zone'), 'Asia/Tokyo');
    await waitFor(async () => {
      expect((await getSettings()).timeZone).toBe('Asia/Tokyo');
    });
    await user.selectOptions(screen.getByLabelText('Time zone'), '__device__');
    await waitFor(async () => {
      expect((await getSettings()).timeZone).toBeUndefined();
    });
  });
});
