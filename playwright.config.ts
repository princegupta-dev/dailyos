import { defineConfig, devices } from '@playwright/test';

/**
 * Browser tests run against the production build (`vite preview`) so they exercise the real
 * bundle and, from Milestone 6, the service worker. They use the locally installed Google
 * Chrome (`channel: 'chrome'`) to avoid downloading browsers; see DEVELOPMENT.md.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  retries: 0,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:4173',
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'iphone-viewport-chrome',
      use: {
        ...devices['iPhone 13'],
        // Device presets default to WebKit; run the iPhone viewport in Chrome instead.
        defaultBrowserType: 'chromium',
        channel: 'chrome',
      },
    },
  ],
  webServer: {
    command: 'pnpm build && pnpm preview --port 4173 --strictPort',
    url: 'http://localhost:4173',
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
