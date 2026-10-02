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

    expect(links.map((l) => l.textContent)).toEqual(['Today', 'Tasks', 'Learn', 'Review']);
    expect(within(nav).getByRole('link', { name: 'Today' })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  it('navigates between primary screens and updates the active item', async () => {
    const user = userEvent.setup();
    renderAt('/');
    const nav = screen.getByRole('navigation', { name: 'Primary' });

    await user.click(within(nav).getByRole('link', { name: 'Tasks' }));
    expect(screen.getByRole('heading', { level: 1, name: 'Tasks' })).toBeInTheDocument();
    expect(within(nav).getByRole('link', { name: 'Tasks' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(within(nav).getByRole('link', { name: 'Today' })).not.toHaveAttribute('aria-current');

    await user.click(within(nav).getByRole('link', { name: 'Learn' }));
    expect(screen.getByRole('heading', { level: 1, name: 'Learn' })).toBeInTheDocument();

    await user.click(within(nav).getByRole('link', { name: 'Review' }));
    expect(screen.getByRole('heading', { level: 1, name: 'Review' })).toBeInTheDocument();
  });

  it('reaches Settings from Today and returns', async () => {
    const user = userEvent.setup();
    renderAt('/');

    await user.click(screen.getByRole('link', { name: 'Settings' }));
    expect(screen.getByRole('heading', { level: 1, name: 'Settings' })).toBeInTheDocument();

    await user.click(screen.getByRole('link', { name: 'Back to Today' }));
    expect(screen.getByText('Today', { selector: '.page-header__eyebrow' })).toBeInTheDocument();
  });

  it('shows a not-found screen for unknown paths', () => {
    renderAt('/does-not-exist');
    expect(screen.getByRole('heading', { level: 1, name: 'Page not found' })).toBeInTheDocument();
  });
});

describe('Today dashboard', () => {
  it('renders every dashboard section', async () => {
    renderAt('/');
    await screen.findByText('Nothing planned for today');
    await screen.findByText('No habits for today');

    for (const name of [
      'Intention',
      'Top outcomes',
      'Tasks',
      'Habits',
      'Recent learning',
      'Evening review',
    ]) {
      expect(screen.getByRole('region', { name })).toBeInTheDocument();
    }
    expect(
      within(screen.getByRole('region', { name: 'Top outcomes' })).getAllByRole('listitem'),
    ).toHaveLength(3);
    expect(screen.getByRole('button', { name: 'Quick capture' })).toBeEnabled();
  });

  it('shows the current local date as the page title', () => {
    renderAt('/');
    const expected = new Intl.DateTimeFormat(undefined, {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    }).format(new Date());
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(expected);
  });
});
