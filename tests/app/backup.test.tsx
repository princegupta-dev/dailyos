import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '@/db/database';
import { exportBackup } from '@/db/repositories/backup';
import { createHabit } from '@/db/repositories/habits';
import { createTask } from '@/db/repositories/tasks';
import { readFileText } from '@/lib/files';
import { resetDatabase, setNow } from '../helpers/db';
import { renderApp } from '../helpers/render';

let downloads: Blob[] = [];

beforeEach(async () => {
  await resetDatabase('UTC');
  setNow('2026-10-02T09:00:00Z');
  downloads = [];
  URL.createObjectURL = vi.fn((blob: Blob) => {
    downloads.push(blob);
    return 'blob:backup';
  });
  URL.revokeObjectURL = vi.fn();
  // jsdom can't navigate to blob URLs; the download itself is the browser's job.
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

const backupFile = async (name = 'dailyos-backup-2026-10-02.json') =>
  new File([JSON.stringify(await exportBackup())], name, { type: 'application/json' });

describe('backup and restore in Settings', () => {
  it('downloads a complete backup and remembers when', async () => {
    await createHabit({ name: 'Read', frequency: 'daily' });
    const user = userEvent.setup();
    renderApp('/settings');

    expect(await screen.findByText('No backup downloaded yet.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Download backup' }));

    expect(await screen.findByText(/^Last backup: Oct 2, 2026/)).toBeInTheDocument();
    expect(downloads).toHaveLength(1);
    const file = JSON.parse(await readFileText(downloads[0]!)) as {
      format: string;
      data: { habits: { name: string }[] };
    };
    expect(file.format).toBe('dailyos-backup');
    expect(file.data.habits.map((h) => h.name)).toEqual(['Read']);
  });

  it('previews a backup, then adds only what is new by default', async () => {
    await createHabit({ name: 'Read', frequency: 'daily' });
    const file = await backupFile();
    await resetDatabase('UTC');
    await createTask({ title: 'Kept task' });

    const user = userEvent.setup();
    renderApp('/settings');
    await user.upload(await screen.findByLabelText('Restore from file'), file);

    const preview = await screen.findByRole('region', { name: 'Backup preview' });
    expect(within(preview).getByText('Habits').nextElementSibling).toHaveTextContent('1');
    expect(within(preview).getByRole('radio', { name: /Add what’s new/ })).toBeChecked();
    await user.click(within(preview).getByRole('button', { name: 'Restore backup' }));

    expect(await screen.findByText(/Backup restored\. \d+ records? added\./)).toBeInTheDocument();
    expect((await db.habits.toArray()).map((h) => h.name)).toEqual(['Read']);
    expect((await db.tasks.toArray()).map((t) => t.title)).toEqual(['Kept task']);
  });

  it('asks for confirmation before replacing everything', async () => {
    await createHabit({ name: 'From backup', frequency: 'daily' });
    const file = await backupFile();
    await resetDatabase('UTC');
    await createHabit({ name: 'On this device', frequency: 'daily' });

    const user = userEvent.setup();
    renderApp('/settings');
    await user.upload(await screen.findByLabelText('Restore from file'), file);
    const preview = await screen.findByRole('region', { name: 'Backup preview' });
    await user.click(within(preview).getByRole('radio', { name: /Replace everything/ }));
    await user.click(within(preview).getByRole('button', { name: 'Restore backup' }));

    const dialog = screen.getByRole('dialog', { name: 'Replace everything on this device?' });
    await user.click(within(dialog).getByRole('button', { name: 'Replace everything' }));

    expect(
      await screen.findByText('Backup restored. This device now matches the backup.'),
    ).toBeInTheDocument();
    await waitFor(async () => {
      expect((await db.habits.toArray()).map((h) => h.name)).toEqual(['From backup']);
    });
  });

  it('explains why a file was rejected and changes nothing', async () => {
    await createHabit({ name: 'Read', frequency: 'daily' });
    const user = userEvent.setup();
    renderApp('/settings');

    const bad = new File(['{"format":"something-else"}'], 'notes.json', {
      type: 'application/json',
    });
    await user.upload(await screen.findByLabelText('Restore from file'), bad);

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Can’t restore notes.json');
    expect(alert).toHaveTextContent('This isn’t a DailyOS backup file.');
    expect(alert).toHaveTextContent('Nothing on this device was changed.');
    expect(screen.queryByRole('region', { name: 'Backup preview' })).not.toBeInTheDocument();
    expect(await db.habits.count()).toBe(1);
  });
});
