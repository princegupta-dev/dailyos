import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/db/database';
import { createLearningEntry } from '@/db/repositories/learning';
import { createTask } from '@/db/repositories/tasks';
import { resetDatabase } from '../helpers/db';
import { renderApp } from '../helpers/render';

const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;

beforeEach(async () => {
  await resetDatabase(zone);
});

describe('learning capture', () => {
  it('quick capture saves a one-line learning note that appears on Today', async () => {
    const user = userEvent.setup();
    renderApp('/');
    await user.click(await screen.findByRole('button', { name: 'Quick capture' }));
    const dialog = screen.getByRole('dialog', { name: 'Quick capture' });
    expect(within(dialog).getByRole('button', { name: 'Learning' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );

    await user.type(
      within(dialog).getByLabelText('What did you learn?'),
      'Native dialog traps focus for free',
    );
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));

    const recent = await screen.findByRole('region', { name: 'Recent learning' });
    expect(
      await within(recent).findByText('Native dialog traps focus for free'),
    ).toBeInTheDocument();
    expect(await db.learningEntries.toArray()).toMatchObject([
      { format: 'quick', relatedTaskIds: [] },
    ]);
  });

  it('creates a structured entry linked to a task with suggested review dates', async () => {
    const task = await createTask({ title: 'Prepare Dexie talk' });
    const user = userEvent.setup();
    renderApp('/learn/new');

    await user.click(await screen.findByRole('button', { name: 'Save entry' }));
    expect(await screen.findByText('Write something to capture')).toBeInTheDocument();

    await user.type(
      screen.getByLabelText('What did you learn?'),
      'Compound indexes enforce uniqueness',
    );
    await user.type(screen.getByLabelText(/^Topic/), 'IndexedDB');
    await user.click(screen.getByText('Add detail'));
    await user.type(screen.getByLabelText('Example'), 'one entry per habit and date');
    await user.selectOptions(screen.getByLabelText('Link an open task'), task.id);
    await user.click(screen.getByRole('button', { name: /Suggest/ }));
    await user.click(screen.getByRole('button', { name: 'Save entry' }));

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Compound indexes enforce uniqueness' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Example' })).toHaveTextContent(
      'one entry per habit and date',
    );
    expect(screen.getByRole('link', { name: 'Prepare Dexie talk' })).toBeInTheDocument();
    const [entry] = await db.learningEntries.toArray();
    expect(entry).toMatchObject({
      format: 'structured',
      topic: 'IndexedDB',
      relatedTaskIds: [task.id],
    });
    expect(entry?.reviewDates).toHaveLength(3);

    // The task shows the reverse link.
    await user.click(screen.getByRole('link', { name: 'Prepare Dexie talk' }));
    expect(await screen.findByRole('region', { name: 'Related learning' })).toBeInTheDocument();
  });

  it('edits an entry and deletes it only after confirmation', async () => {
    const entry = await createLearningEntry({ content: 'Initial thought' });
    const user = userEvent.setup();
    renderApp(`/learn/${entry.id}`);

    await user.click(await screen.findByRole('button', { name: 'Edit' }));
    const title = screen.getByLabelText(/^Title/);
    await user.clear(title);
    await user.type(title, 'Refined thought');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Refined thought' }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Delete' }));
    const dialog = screen.getByRole('dialog', { name: 'Delete this entry?' });
    await user.click(within(dialog).getByRole('button', { name: 'Keep as is' }));
    expect(await db.learningEntries.count()).toBe(1);

    await user.click(screen.getByRole('button', { name: 'Delete' }));
    await user.click(
      within(screen.getByRole('dialog', { name: 'Delete this entry?' })).getByRole('button', {
        name: 'Delete permanently',
      }),
    );
    await waitFor(async () => {
      expect(await db.learningEntries.count()).toBe(0);
    });
    expect(await screen.findByRole('heading', { level: 1, name: 'Learn' })).toBeInTheDocument();
  });
});

describe('learning search', () => {
  it('searches by text and filters by topic', async () => {
    await createLearningEntry({ content: 'Closures capture variables', topic: 'JavaScript' });
    await createLearningEntry({ content: 'Generics constrain types', topic: 'TypeScript' });
    await createLearningEntry({ content: 'Mapped types transform keys', topic: 'TypeScript' });
    const user = userEvent.setup();
    renderApp('/learn');

    const list = await screen.findByRole('list', { name: 'Learning entries' });
    expect(within(list).getAllByRole('listitem')).toHaveLength(3);

    await user.type(screen.getByRole('searchbox', { name: 'Search learning' }), 'types');
    await waitFor(() => {
      expect(
        within(screen.getByRole('list', { name: 'Learning entries' })).getAllByRole('listitem'),
      ).toHaveLength(2);
    });
    expect(screen.getByText('2 of 3 entries')).toBeInTheDocument();

    await user.clear(screen.getByRole('searchbox', { name: 'Search learning' }));
    await user.click(await screen.findByText('Filters'));
    await user.selectOptions(screen.getByLabelText('Topic'), 'JavaScript');
    await waitFor(() => {
      expect(
        within(screen.getByRole('list', { name: 'Learning entries' })).getAllByRole('listitem'),
      ).toHaveLength(1);
    });

    await user.type(screen.getByRole('searchbox', { name: 'Search learning' }), 'generics');
    expect(await screen.findByText('No matches')).toBeInTheDocument();
  });
});
