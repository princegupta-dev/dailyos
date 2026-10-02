import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { listTasks } from '@/db/repositories/tasks';
import { getDayPlan } from '@/db/repositories/plans';
import { toLocalDateKey } from '@/lib/dates';
import { resetDatabase } from '../helpers/db';
import { renderApp } from '../helpers/render';

const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;

beforeEach(async () => {
  await resetDatabase(zone);
});

describe('tasks UI', () => {
  it('creates a task from the form and shows validation errors inline', async () => {
    const user = userEvent.setup();
    renderApp('/tasks/new');

    await user.click(await screen.findByRole('button', { name: 'Create task' }));
    expect(await screen.findByText('Title is required')).toBeInTheDocument();
    expect(screen.getByLabelText('Title')).toHaveAttribute('aria-invalid', 'true');

    await user.type(screen.getByLabelText('Title'), 'Read the Dexie docs');
    await user.selectOptions(screen.getByLabelText('Priority'), 'high');
    await user.type(screen.getByLabelText('Estimate (minutes)'), '30');
    await user.click(screen.getByRole('button', { name: 'Create task' }));

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Read the Dexie docs' }),
    ).toBeInTheDocument();
    const inbox = await listTasks('inbox');
    expect(inbox).toHaveLength(1);
    expect(inbox[0]?.task).toMatchObject({ priority: 'high', estimatedMinutes: 30 });
  });

  it('completes and reopens a task from the list, recording history', async () => {
    const user = userEvent.setup();
    renderApp('/tasks/new');
    await user.type(await screen.findByLabelText('Title'), 'Water plants');
    await user.click(screen.getByLabelText('Plan for today'));
    await user.click(screen.getByRole('button', { name: 'Create task' }));
    await screen.findByRole('heading', { level: 1, name: 'Water plants' });

    await user.click(screen.getByRole('button', { name: /Complete/ }));
    expect(await screen.findByRole('button', { name: /Reopen/ })).toBeInTheDocument();

    const history = screen.getByRole('region', { name: 'History' });
    expect(within(history).getByText('Completed')).toBeInTheDocument();
    expect(within(history).getByText(/Planned for today/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Reopen/ }));
    expect(await within(history).findByText('Reopened')).toBeInTheDocument();
  });

  it('plans tasks from the Today screen and tracks progress', async () => {
    const user = userEvent.setup();
    renderApp('/');

    await user.click(await screen.findByRole('button', { name: 'Plan tasks' }));
    const dialog = screen.getByRole('dialog', { name: 'Plan tasks' });
    await user.type(within(dialog).getByLabelText('New task'), 'Outline talk');
    await user.click(within(dialog).getByRole('button', { name: 'Add' }));
    await user.type(within(dialog).getByLabelText('New task'), 'Book flights');
    await user.click(within(dialog).getByRole('button', { name: 'Add' }));
    await user.click(within(dialog).getByRole('button', { name: 'Close' }));

    const todayList = await screen.findByRole('list', { name: 'Today’s tasks' });
    await waitFor(() => {
      expect(within(todayList).getAllByRole('listitem')).toHaveLength(2);
    });
    expect(screen.getByText('0 of 2 done')).toBeInTheDocument();

    await user.click(within(todayList).getByRole('checkbox', { name: 'Complete “Outline talk”' }));
    expect(await screen.findByText('1 of 2 done')).toBeInTheDocument();

    const today = toLocalDateKey(new Date(), zone);
    const plan = await getDayPlan(today, today);
    expect(plan.entries.map((e) => e.outcome).sort()).toEqual(['done', 'open']);
  });

  it('quick capture saves a task to the inbox', async () => {
    const user = userEvent.setup();
    renderApp('/');
    await user.click(await screen.findByRole('button', { name: 'Capture a note or task' }));
    const dialog = screen.getByRole('dialog', { name: 'Quick capture' });
    await user.click(within(dialog).getByRole('button', { name: 'Task' }));
    await user.type(within(dialog).getByLabelText('Task'), 'Call the bank');
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));

    expect(await screen.findByText('Task added to inbox')).toBeInTheDocument();
    expect((await listTasks('inbox')).map((i) => i.task.title)).toEqual(['Call the bank']);
  });
});
