import { test as base } from '@playwright/test';

/**
 * Browser tests start signed in, as a returning user who has finished profile setup.
 * Sign-in is simulated on the frontend (see src/services/auth.service.ts).
 */
export const test = base.extend({
  page: async ({ page }, provide) => {
    await page.addInitScript(() => {
      if (localStorage.getItem('dailyos.session')) return;
      localStorage.setItem(
        'dailyos.session',
        JSON.stringify({
          user: { name: 'E2E User', email: 'e2e@example.com', provider: 'email' },
          isNewAccount: false,
          profileSetupDone: true,
        }),
      );
    });
    await provide(page);
  },
});

export { expect } from '@playwright/test';
