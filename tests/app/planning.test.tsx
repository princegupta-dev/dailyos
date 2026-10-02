import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/db/database';
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
    await user.type(screen.getByLabelText('Outcome 1'), 'Finish chapter draft');
    await user.type(screen.getByLabelText('Outcome 2'), 'Run 5k');
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

    await user.click(screen.getByRole('checkbox', { name: 'Outcome 1 done' }));
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

describe('habits', () => {
  it('creates a selected-days habit with validation and checks it off on Today when scheduled', async () => {
    const user = userEvent.setup();
    renderApp('/settings/habits/new');

    await user.type(await screen.findByLabelText('Name'), 'Stretch');
    await user.click(screen.getByLabelText(/Specific days/));
    // Clear the default weekday selection to trigger validation.
    for (const day of ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']) {
      await user.click(screen.getByLabelText(day));
    }
    await user.click(screen.getByRole('button', { name: 'Create habit' }));
    expect(await screen.findByText('Choose at least one day')).toBeInTheDocument();

    for (const day of ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']) {
      await user.click(screen.getByLabelText(day));
    }
    await user.click(screen.getByRole('button', { name: 'Create habit' }));
    expect(await screen.findByRole('link', { name: /Stretch/ })).toBeInTheDocument();

    await user.click(screen.getByRole('link', { name: 'Back to Today' }));
    const habits = await screen.findByRole('region', { name: 'Habits' });
    const group = await within(habits).findByRole('group', { name: 'Stretch status' });
    await user.click(within(group).getByRole('button', { name: 'Done' }));

    await waitFor(() => {
      expect(within(group).getByRole('button', { name: 'Done' })).toHaveAttribute(
        'aria-pressed',
        'true',
      );
    });
    expect(within(habits).getByText('1 of 1 done')).toBeInTheDocument();
    expect(await db.habitEntries.toArray()).toMatchObject([{ date: today(), status: 'completed' }]);

    // Pressing the active status clears it.
    await user.click(within(group).getByRole('button', { name: 'Done' }));
    await waitFor(async () => {
      expect(await db.habitEntries.count()).toBe(0);
    });
  });

  it('skipping keeps the habit out of the done count', async () => {
    const user = userEvent.setup();
    renderApp('/settings/habits/new');
    await user.type(await screen.findByLabelText('Name'), 'Meditate');
    await user.click(screen.getByRole('button', { name: 'Create habit' }));
    await screen.findByRole('link', { name: /Meditate/ });
    await user.click(screen.getByRole('link', { name: 'Back to Today' }));

    const group = await screen.findByRole('group', { name: 'Meditate status' });
    await user.click(within(group).getByRole('button', { name: 'Skip' }));
    await waitFor(() => {
      expect(within(group).getByRole('button', { name: 'Skip' })).toHaveAttribute(
        'aria-pressed',
        'true',
      );
    });
    expect(
      within(screen.getByRole('region', { name: 'Habits' })).queryByText(/of .* done/),
    ).not.toBeInTheDocument();
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
