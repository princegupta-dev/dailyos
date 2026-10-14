import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { resetDatabase } from '../helpers/db';
import { renderApp as renderAt } from '../helpers/render';

beforeEach(async () => {
  await resetDatabase(Intl.DateTimeFormat().resolvedOptions().timeZone);
});

describe('app navigation', () => {
  it('shows the five primary destinations with Dashboard active by default', () => {
    renderAt('/');
    const nav = screen.getByRole('navigation', { name: 'Primary' });
    const links = within(nav).getAllByRole('link');

    expect(links.map((l) => l.textContent)).toEqual([
      'Dashboard',
      'Commitments',
      'Investments',
      'Settings',
      'Profile',
    ]);
    expect(within(nav).getByRole('link', { name: 'Dashboard' })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  it('navigates between primary screens and updates the active item', async () => {
    const user = userEvent.setup();
    renderAt('/');
    const nav = screen.getByRole('navigation', { name: 'Primary' });

    await user.click(within(nav).getByRole('link', { name: 'Commitments' }));
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Commitments' }),
    ).toBeInTheDocument();
    expect(within(nav).getByRole('link', { name: 'Commitments' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(within(nav).getByRole('link', { name: 'Dashboard' })).not.toHaveAttribute(
      'aria-current',
    );

    await user.click(within(nav).getByRole('link', { name: 'Investments' }));
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Investments' }),
    ).toBeInTheDocument();

    await user.click(within(nav).getByRole('link', { name: 'Settings' }));
    expect(screen.getByRole('heading', { level: 1, name: 'Settings' })).toBeInTheDocument();

    await user.click(within(nav).getByRole('link', { name: 'Profile' }));
    expect(screen.getByRole('heading', { level: 1, name: 'Profile' })).toBeInTheDocument();
  });

  it('opens each Settings screen with Settings active, and returns to the hub', async () => {
    const user = userEvent.setup();
    renderAt('/settings');
    const nav = screen.getByRole('navigation', { name: 'Primary' });
    const screens = [
      ['Insights', 'Insights'],
      ['Reviews', 'Review'],
      ['Tasks', 'Tasks'],
      ['Open actions', 'Open actions'],
      ['Learnings', 'Learn'],
      ['Intentions & priorities', 'Intentions & priorities'],
    ] as const;

    for (const [row, heading] of screens) {
      await user.click(screen.getByRole('link', { name: new RegExp(`^${row}`) }));
      expect(await screen.findByRole('heading', { level: 1, name: heading })).toBeInTheDocument();
      expect(within(nav).getByRole('link', { name: 'Settings' })).toHaveAttribute(
        'aria-current',
        'page',
      );
      await user.click(screen.getByRole('link', { name: 'Back to Settings' }));
      expect(
        await screen.findByRole('heading', { level: 1, name: 'Settings' }),
      ).toBeInTheDocument();
    }
  });

  it('opens each Profile screen and returns to Profile', async () => {
    const user = userEvent.setup();
    renderAt('/profile');
    expect(screen.getByRole('link', { name: /^App preferences/ })).toHaveAttribute(
      'href',
      '/profile/preferences',
    );

    for (const [row, heading] of [
      ['Personal information', 'Personal information'],
      ['Health & wellness', 'Health & wellness'],
      ['Professional information', 'Professional information'],
      ['Lifestyle & preferences', 'Lifestyle & preferences'],
      ['App preferences', 'App preferences'],
      ['Data & privacy', 'Data & privacy'],
      ['Account & security', 'Account & security'],
      ['Help & support', 'Help & support'],
      ['About', 'About'],
    ] as const) {
      await user.click(screen.getByRole('link', { name: new RegExp(`^${row}`) }));
      expect(await screen.findByRole('heading', { level: 1, name: heading })).toBeInTheDocument();
      await user.click(screen.getByRole('link', { name: 'Back to Profile' }));
      expect(await screen.findByRole('heading', { level: 1, name: 'Profile' })).toBeInTheDocument();
    }
  });

  it('reaches Profile from the Dashboard header', async () => {
    const user = userEvent.setup();
    renderAt('/');

    const header = screen.getByRole('banner');
    await user.click(within(header).getByRole('link', { name: 'Profile' }));
    expect(screen.getByRole('heading', { level: 1, name: 'Profile' })).toBeInTheDocument();
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
    expect(screen.getByRole('button', { name: 'Capture a note, task, or expense' })).toBeEnabled();
    // Each section loads independently, so wait for Tasks too.
    expect(await screen.findByRole('link', { name: 'All tasks' })).toHaveAttribute(
      'href',
      '/tasks',
    );
  });

  it('shows the current local date in the header', () => {
    renderAt('/');
    const expected = new Intl.DateTimeFormat(undefined, { month: 'long', day: 'numeric' }).format(
      new Date(),
    );
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(expected);
  });
});
