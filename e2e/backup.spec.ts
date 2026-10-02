import { expect, test } from '@playwright/test';

test('a downloaded backup restores everything after the browser data is wiped', async ({
  page,
}) => {
  await page.goto('/habits/new');
  await page.getByLabel('Habit name').fill('Read 20 pages');
  await page.getByRole('button', { name: 'Next' }).click();
  await page.getByRole('button', { name: 'Skip this step' }).click();
  await page.getByRole('button', { name: 'Create habit' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Read 20 pages' })).toBeVisible();

  await page.goto('/habits');
  // The checkbox reflects stored state, so it flips once the IndexedDB write lands.
  await page.getByRole('checkbox', { name: 'Mark Read 20 pages done' }).click();
  await expect(page.getByRole('checkbox', { name: 'Mark Read 20 pages done' })).toBeChecked();

  await page.goto('/settings');
  const downloading = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download backup' }).click();
  const download = await downloading;
  expect(download.suggestedFilename()).toMatch(/^dailyos-backup-\d{4}-\d{2}-\d{2}\.json$/);
  const backupPath = test.info().outputPath('backup.json');
  await download.saveAs(backupPath);
  await expect(page.getByText(/^Last backup:/)).toBeVisible();

  // Simulate clearing site data.
  await page.evaluate(
    () =>
      new Promise<void>((resolve, reject) => {
        const request = indexedDB.deleteDatabase('dailyos');
        request.onsuccess = () => {
          resolve();
        };
        request.onerror = () => {
          reject(new Error('delete failed'));
        };
        request.onblocked = () => {
          resolve();
        };
      }),
  );
  await page.goto('/habits');
  await expect(page.getByText('No habits yet')).toBeVisible();

  await page.goto('/settings');
  await page.getByLabel('Restore from file').setInputFiles(backupPath);
  const preview = page.getByRole('region', { name: 'Backup preview' });
  await expect(preview).toContainText('Habits');
  await preview.getByRole('button', { name: 'Restore backup' }).click();
  await expect(page.getByText(/Backup restored/)).toBeVisible();

  await page.reload();
  await page.goto('/habits');
  await expect(page.getByRole('checkbox', { name: 'Mark Read 20 pages done' })).toBeChecked();
});
