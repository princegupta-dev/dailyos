import { expect, test } from '@playwright/test';

test('tasks persist in IndexedDB across a full page reload', async ({ page }) => {
  await page.goto('/tasks/new');
  await page.getByLabel('Title').fill('Persist me');
  await page.getByLabel('Plan for today').check();
  await page.getByRole('button', { name: 'Create task' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Persist me' })).toBeVisible();

  await page.reload();
  await expect(page.getByRole('heading', { level: 1, name: 'Persist me' })).toBeVisible();

  await page.goto('/');
  const todayList = page.getByRole('list', { name: 'Today’s tasks' });
  await expect(todayList.getByRole('link', { name: 'Persist me' })).toBeVisible();
  // The checkbox reflects stored state, so it flips once the IndexedDB write lands.
  await todayList.getByRole('checkbox', { name: 'Complete “Persist me”' }).click();
  await expect(todayList.getByRole('checkbox', { name: 'Reopen “Persist me”' })).toBeChecked();
  await expect(page.getByText('1 of 1 done')).toBeVisible();

  await page.reload();
  await expect(page.getByText('1 of 1 done')).toBeVisible();
});
