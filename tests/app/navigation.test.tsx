import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { resetDatabase } from '../helpers/db';
import { renderApp as renderAt } from '../helpers/render';

beforeEach(async () => {
  await resetDatabase(Intl.DateTimeFormat().resolvedOptions().timeZone);
});

describe('app navigation', () => {
  it('shows the four primary destinations with Today active by default', () => {
    renderAt('/');
    const nav = screen.getByRole('navigation', { name: 'Primary' });
    const links = within(nav).getAllByRole('link');

    expect(links.map((l) => l.textContent)).toEqual(['Today', 'Habits', 'Insights', 'Review']);
    expect(within(nav).getByRole('link', { name: 'Today' })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  it('navigates between primary screens and updates the active item', async () => {
    const user = userEvent.setup();
    renderAt('/');
    const nav = screen.getByRole('navigation', { name: 'Primary' });

    await user.click(within(nav).getByRole('link', { name: 'Habits' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Habits' })).toBeInTheDocument();
    expect(within(nav).getByRole('link', { name: 'Habits' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(within(nav).getByRole('link', { name: 'Today' })).not.toHaveAttribute('aria-current');

    await user.click(within(nav).getByRole('link', { name: 'Insights' }));
    expect(screen.getByRole('heading', { level: 1, name: 'Insights' })).toBeInTheDocument();

    await user.click(within(nav).getByRole('link', { name: 'Review' }));
    expect(screen.getByRole('heading', { level: 1, name: 'Review' })).toBeInTheDocument();
  });

  it('keeps Tasks and Learn reachable as secondary screens with their parent tab active', async () => {
    const user = userEvent.setup();
    renderAt('/insights');
    const nav = screen.getByRole('navigation', { name: 'Primary' });

    await user.click(await screen.findByRole('link', { name: /Notes and learning/ }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Learn' })).toBeInTheDocument();
    expect(within(nav).getByRole('link', { name: 'Insights' })).toHaveAttribute(
      'aria-current',
      'page',
    );

    await user.click(within(nav).getByRole('link', { name: 'Insights' }));
    await user.click(await screen.findByRole('link', { name: /^Tasks/ }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Tasks' })).toBeInTheDocument();
    expect(within(nav).getByRole('link', { name: 'Today' })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  it('reaches Settings from Today and returns', async () => {
    const user = userEvent.setup();
    renderAt('/');

    await user.click(screen.getByRole('link', { name: 'Settings' }));
    expect(screen.getByRole('heading', { level: 1, name: 'Settings' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Manage habits/ })).toHaveAttribute('href', '/habits');

    await user.click(screen.getByRole('link', { name: 'Back to Today' }));
    expect(await screen.findByRole('region', { name: 'Habits' })).toBeInTheDocument();
  });

  it('redirects old habit links from Settings to the Habits screens', async () => {
    const { router } = renderAt('/settings/habits/new');
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Create habit' }),
    ).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/habits/new');
  });

  it('shows a not-found screen for unknown paths', () => {
    renderAt('/does-not-exist');
    expect(screen.getByRole('heading', { level: 1, name: 'Page not found' })).toBeInTheDocument();
  });
});

describe('Today', () => {
  it('shows only the daily essentials', async () => {
    renderAt('/');
    await screen.findByText('No habits scheduled today');

    for (const name of ['Habits', 'Intention', 'Priorities', 'Tasks', 'Evening review']) {
      expect(screen.getByRole('region', { name })).toBeInTheDocument();
    }
    expect(screen.queryByRole('region', { name: 'Recent learning' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Capture a note or task' })).toBeEnabled();
    expect(screen.getByRole('link', { name: 'All tasks' })).toHaveAttribute('href', '/tasks');
  });

  it('shows the current local date in the header', () => {
    renderAt('/');
    const expected = new Intl.DateTimeFormat(undefined, { month: 'long', day: 'numeric' }).format(
      new Date(),
    );
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(expected);
  });
});
