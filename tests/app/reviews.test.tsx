import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '@/db/database';
import { createHabit, setHabitStatus } from '@/db/repositories/habits';
import { saveReview } from '@/db/repositories/reviews';
import { completeTask, createTask } from '@/db/repositories/tasks';
import { periodContaining } from '@/domain/review';
import { resetDatabase, setNow } from '../helpers/db';
import { renderApp } from '../helpers/render';

beforeEach(async () => {
  await resetDatabase('UTC');
  setNow('2026-10-02T18:00:00Z'); // Friday
});

afterEach(() => {
  vi.useRealTimers();
});

describe('daily review', () => {
  it('shows plan versus actual, saves the reflection, and carries actions to Today', async () => {
    const planned = await createTask({ title: 'Write release notes' }, { planFor: '2026-10-02' });
    await createTask({ title: 'Update docs' }, { planFor: '2026-10-02' });
    await completeTask(planned.id);
    const user = userEvent.setup();
    renderApp('/');

    await user.click(await screen.findByRole('link', { name: 'Start evening review' }));
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Friday, October 2' }),
    ).toBeInTheDocument();
    const summary = await screen.findByRole('region', { name: 'Planned vs. actual' });
    expect(within(summary).getByText('1 of 2 planned tasks done')).toBeInTheDocument();
    expect(within(summary).getByText('50%')).toBeInTheDocument();

    await user.click(screen.getByRole('radio', { name: '4' }));
    await user.type(screen.getByLabelText('What went well today?'), 'Release notes shipped');
    await user.type(screen.getByLabelText('Focus for tomorrow'), 'Docs first thing');
    await user.click(screen.getByRole('button', { name: 'Add action' }));
    await user.type(screen.getByLabelText('Action 1'), 'Ask Sam for review');
    await user.click(screen.getByRole('button', { name: 'Save review' }));
    expect(await screen.findByText('Review saved')).toBeInTheDocument();

    // Saving again must update, not duplicate, the action.
    await user.click(await screen.findByRole('button', { name: 'Save changes' }));
    await waitFor(async () => {
      expect(await db.reviewActions.count()).toBe(1);
    });
    expect(await db.reviews.toArray()).toMatchObject([
      { rating: 4, wins: 'Release notes shipped' },
    ]);

    await user.click(screen.getByRole('link', { name: 'Today' }));
    const evening = await screen.findByRole('region', { name: 'Evening review' });
    expect(await within(evening).findByText('Ask Sam for review')).toBeInTheDocument();
    expect(within(evening).getByRole('link', { name: 'Open today’s review' })).toBeInTheDocument();

    await user.click(
      within(evening).getByRole('checkbox', { name: 'Mark “Ask Sam for review” done' }),
    );
    await waitFor(async () => {
      expect((await db.reviewActions.toArray())[0]?.status).toBe('done');
    });
  });

  it('shows yesterday’s focus and earlier open actions on the next review', async () => {
    await saveReview(periodContaining('daily', '2026-10-01', 1), {
      focus: 'Finish the migration',
      actions: [{ title: 'Email landlord' }],
    });
    const user = userEvent.setup();
    renderApp('/review/daily/2026-10-02');

    expect(await screen.findByText('Finish the migration')).toBeInTheDocument();
    const carried = await screen.findByRole('region', { name: 'Still open from earlier' });
    await user.click(within(carried).getByRole('button', { name: 'Make “Email landlord” a task' }));
    expect(await within(carried).findByRole('link', { name: 'View task' })).toBeInTheDocument();
    expect((await db.tasks.toArray()).map((t) => t.title)).toEqual(['Email landlord']);
  });

  it('does not allow reviewing a future day', async () => {
    renderApp('/review/daily/2026-10-03');
    expect(await screen.findByText('This period hasn’t started yet.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Save review' })).not.toBeInTheDocument();
  });
});

describe('weekly and monthly reviews', () => {
  it('normalizes the URL to the week start and shows computed stats', async () => {
    const habit = await createHabit({ name: 'Read', frequency: 'daily' });
    await setHabitStatus(habit.id, '2026-10-02', 'completed');
    const task = await createTask({ title: 'Done this week' });
    await completeTask(task.id);
    const { router } = renderApp('/review/weekly/2026-10-02');

    // Oct 2 falls in the week starting Monday, Sep 28 (the default week start).
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Week of September 28' }),
    ).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/review/weekly/2026-09-28');

    const stats = await screen.findByText('Tasks done');
    expect(stats.nextElementSibling).toHaveTextContent('1');
    const habits = await screen.findByRole('region', { name: 'Habit consistency' });
    // The habit started today (Oct 2) and is done, so 1 of 1 eligible occurrences.
    expect(within(habits).getByText(/100% · 1 of 1/)).toBeInTheDocument();
  });

  it('renders monthly week-by-week trend rows', async () => {
    renderApp('/review/monthly/2026-10-01');
    const trend = await screen.findByRole('table');
    expect(within(trend).getAllByRole('row').length).toBeGreaterThan(1);
    expect(screen.getByLabelText('Focus for next month')).toBeInTheDocument();
  });

  it('lists review shortcuts with reviewed state on the hub', async () => {
    await saveReview(periodContaining('weekly', '2026-10-02', 1), { wins: 'x' });
    renderApp('/review');
    const thisWeek = await screen.findByRole('link', { name: /This week/ });
    await waitFor(() => {
      expect(thisWeek).toHaveTextContent('Reviewed');
    });
    expect(screen.getByRole('link', { name: /Last week/ })).toHaveTextContent('Not reviewed');
  });
});
