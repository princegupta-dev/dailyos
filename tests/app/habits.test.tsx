import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '@/db/database';
import { createHabit, setHabitStatus } from '@/db/repositories/habits';
import { resetDatabase, setNow } from '../helpers/db';
import { renderApp } from '../helpers/render';

beforeEach(async () => {
  await resetDatabase('UTC');
  setNow('2026-10-02T09:00:00Z'); // Friday
});

afterEach(() => {
  vi.useRealTimers();
});

describe('creating a habit', () => {
  it('walks through three short steps where only the name is required', async () => {
    const user = userEvent.setup();
    const { router } = renderApp('/habits/new');

    await user.click(await screen.findByRole('button', { name: 'Next' }));
    expect(await screen.findByText('Name is required')).toBeInTheDocument();

    await user.type(screen.getByLabelText('Habit name'), 'Gym workout');
    await user.click(screen.getByRole('radio', { name: 'Fitness' }));
    await user.click(screen.getByRole('button', { name: 'Next' }));

    await user.type(screen.getByLabelText('Minimum version'), '15 minute walk');
    await user.click(screen.getByRole('switch', { name: /Allow alternatives/ }));
    await user.click(screen.getByRole('button', { name: 'Add alternative' }));
    await user.type(screen.getByLabelText('Alternative 1'), 'Running');
    await user.click(screen.getByRole('button', { name: 'Next' }));

    await user.click(screen.getByRole('radio', { name: 'Weekdays' }));
    await user.type(screen.getByLabelText('Target'), '45');
    await user.type(screen.getByLabelText('Unit'), 'min');
    await user.click(screen.getByRole('button', { name: 'Create habit' }));

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Gym workout' }),
    ).toBeInTheDocument();
    expect(router.state.location.pathname).toMatch(/^\/habits\/[0-9a-f-]{36}$/);
    expect(screen.getByText('Fitness · Weekdays')).toBeInTheDocument();
    expect(await db.habits.toArray()).toMatchObject([
      {
        category: 'fitness',
        frequency: 'selected_days',
        weekdays: [1, 2, 3, 4, 5],
        target: 45,
        unit: 'min',
        minimumTarget: '15 minute walk',
        alternatives: ['Running'],
      },
    ]);
  });

  it('returns to the schedule step when the chosen days are invalid', async () => {
    const user = userEvent.setup();
    renderApp('/habits/new');
    await user.type(await screen.findByLabelText('Habit name'), 'Stretch');
    await user.click(screen.getByRole('button', { name: 'Next' }));
    await user.click(screen.getByRole('button', { name: 'Skip this step' }));
    await user.click(screen.getByRole('radio', { name: 'Specific days' }));
    for (const day of ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']) {
      await user.click(screen.getByLabelText(day));
    }
    await user.click(screen.getByRole('button', { name: 'Create habit' }));
    expect(await screen.findByText('Choose at least one day')).toBeInTheDocument();
    expect(await db.habits.count()).toBe(0);
  });
});

describe('completing habits on Today', () => {
  it('completes with one tap and undoes an accidental tap', async () => {
    await createHabit({ name: 'Read', category: 'reading', frequency: 'daily' });
    const user = userEvent.setup();
    renderApp('/');

    const check = await screen.findByRole('checkbox', { name: 'Mark Read done' });
    expect(check).not.toBeChecked();
    await user.click(check);
    await waitFor(() => {
      expect(check).toBeChecked();
    });
    expect(
      await screen.findByRole('img', { name: '1 of 1 habits done today' }),
    ).toBeInTheDocument();
    expect(await db.habitEntries.toArray()).toMatchObject([
      { date: '2026-10-02', status: 'completed' },
    ]);

    await user.click(check);
    await waitFor(async () => {
      expect(await db.habitEntries.count()).toBe(0);
    });
    await waitFor(() => {
      expect(screen.getByRole('checkbox', { name: 'Mark Read done' })).not.toBeChecked();
    });
  });

  it('logs optional activity details without requiring them', async () => {
    await createHabit({
      name: 'Gym',
      category: 'fitness',
      frequency: 'daily',
      target: 45,
      unit: 'min',
    });
    const user = userEvent.setup();
    renderApp('/');

    await user.click(await screen.findByRole('button', { name: 'More options for Gym' }));
    const sheet = screen.getByRole('dialog', { name: 'Gym' });
    await user.type(within(sheet).getByLabelText(/^Amount/), '50');
    await user.click(within(sheet).getByText('Add details'));
    await user.type(within(sheet).getByLabelText('Workout or muscle group'), 'Push day');
    await user.type(within(sheet).getByLabelText('Exercises, sets, reps'), 'Bench 3x8');
    await user.click(within(sheet).getByRole('button', { name: 'Save' }));

    await waitFor(async () => {
      expect(await db.habitEntries.toArray()).toMatchObject([
        { status: 'completed', amount: 50, log: { workout: 'Push day', details: 'Bench 3x8' } },
      ]);
    });
    expect(await screen.findByText('50 / 45 min')).toBeInTheDocument();
  });

  it('records a skip honestly and leaves it out of the done count', async () => {
    await createHabit({ name: 'Read', frequency: 'daily' });
    await createHabit({ name: 'Meditate', frequency: 'daily' });
    const user = userEvent.setup();
    renderApp('/');

    await user.click(await screen.findByRole('button', { name: 'More options for Meditate' }));
    const sheet = screen.getByRole('dialog', { name: 'Meditate' });
    await user.click(within(sheet).getByRole('radio', { name: 'Skipped' }));
    await user.type(within(sheet).getByLabelText(/What got in the way/), 'Travel day');
    await user.click(within(sheet).getByRole('button', { name: 'Save' }));

    const row = (await screen.findByRole('link', { name: /^Meditate/ })).closest('li');
    await waitFor(() => {
      expect(row).toHaveTextContent('Skipped');
    });
    expect(within(row!).getByRole('checkbox', { name: 'Mark Meditate done' })).not.toBeChecked();
    expect(
      await screen.findByRole('img', { name: '0 of 1 habits done today' }),
    ).toBeInTheDocument();
    expect(await db.habitEntries.toArray()).toMatchObject([
      { status: 'skipped', note: 'Travel day' },
    ]);
  });
});

describe('habits list', () => {
  it('shows every habit, checks off today’s, and crosses out completed ones', async () => {
    await createHabit({ name: 'Read', category: 'reading', frequency: 'daily' });
    // Friday 2026-10-02: a Monday-only habit can't be checked off today.
    await createHabit({ name: 'Long run', frequency: 'selected_days', weekdays: [1] });
    const user = userEvent.setup();
    const { router } = renderApp('/habits');

    const list = await screen.findByRole('list', { name: 'All habits' });
    expect(within(list).getAllByRole('listitem')).toHaveLength(2);
    expect(screen.queryByRole('radiogroup')).not.toBeInTheDocument();
    expect(within(list).getByText(/Not today/)).toBeInTheDocument();
    expect(
      within(list).queryByRole('checkbox', { name: 'Mark Long run done' }),
    ).not.toBeInTheDocument();

    await user.click(within(list).getByRole('checkbox', { name: 'Mark Read done' }));
    await waitFor(() => {
      expect(within(list).getByText('Read').closest('li')).toHaveClass('habit-row--done');
    });
    expect(router.state.location.pathname).toBe('/habits');
    expect(await db.habitEntries.toArray()).toMatchObject([
      { date: '2026-10-02', status: 'completed' },
    ]);

    await user.click(within(list).getByRole('link', { name: /^Long run/ }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Long run' })).toBeInTheDocument();
    expect(router.state.location.pathname).toMatch(/^\/habits\/[0-9a-f-]{36}$/);
  });
});

describe('habit detail', () => {
  it('shows streak stats and lets a past day be corrected from the calendar', async () => {
    setNow('2026-09-28T09:00:00Z');
    const habit = await createHabit({ name: 'Read', category: 'reading', frequency: 'daily' });
    await setHabitStatus(habit.id, '2026-09-28', 'completed');
    setNow('2026-09-29T09:00:00Z');
    await setHabitStatus(habit.id, '2026-09-29', 'completed');
    setNow('2026-10-01T09:00:00Z');
    await setHabitStatus(habit.id, '2026-10-01', 'completed');
    setNow('2026-10-02T09:00:00Z');

    const user = userEvent.setup();
    renderApp(`/habits/${habit.id}`);

    const stat = (label: string) => screen.getByText(label).nextElementSibling;
    await screen.findByText('Streak');
    expect(stat('Streak')).toHaveTextContent('1');
    expect(stat('Best')).toHaveTextContent('2');
    expect(stat('Total')).toHaveTextContent('3');

    await user.click(screen.getByRole('button', { name: 'Calendar' }));
    // The calendar opens on the current month; Sep 30 is in the previous one.
    await user.click(screen.getByRole('button', { name: 'Previous month' }));
    await user.click(screen.getByRole('button', { name: 'Wednesday, September 30, missed' }));
    const sheet = screen.getByRole('dialog', { name: 'Read' });
    await user.click(within(sheet).getByRole('button', { name: 'Save' }));

    expect(
      await screen.findByRole('button', { name: 'Wednesday, September 30, done' }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Overview' }));
    await waitFor(() => {
      expect(stat('Best')).toHaveTextContent('4');
    });
  });
});
