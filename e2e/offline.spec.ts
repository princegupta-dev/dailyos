import { expect, test } from '@playwright/test';

test('installs for offline use and keeps working without a connection', async ({
  page,
  context,
}) => {
  await page.goto('/habits');
  await expect(page.getByRole('heading', { level: 1, name: 'Habits' })).toBeVisible();
  // The service worker precaches the app shell, then controls the page after a reload.
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  expect(await page.evaluate(() => navigator.serviceWorker.controller !== null)).toBe(true);

  const manifest = page.locator('link[rel="manifest"]');
  await expect(manifest).toHaveAttribute('href', /manifest\.webmanifest$/);

  await context.setOffline(true);
  await page.goto('/habits/new');
  await page.getByLabel('Habit name').fill('Offline habit');
  await page.getByRole('button', { name: 'Next' }).click();
  await page.getByRole('button', { name: 'Skip this step' }).click();
  await page.getByRole('button', { name: 'Create habit' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Offline habit' })).toBeVisible();

  await page.goto('/habits');
  // The checkbox reflects stored state, so it flips once the IndexedDB write lands.
  await page.getByRole('checkbox', { name: 'Mark Offline habit done' }).click();
  await expect(page.getByRole('checkbox', { name: 'Mark Offline habit done' })).toBeChecked();
  await context.setOffline(false);
});
