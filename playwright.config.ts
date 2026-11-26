import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 60_000,
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: 'http://localhost:4173/',
    trace: 'off',
    serviceWorkers: 'allow',
  },
  // Browser emulation of an iPhone 16 (Chromium engine) – NOT a replacement for testing on a real iPhone.
  projects: [
    { name: 'iphone-16', use: { ...devices['iPhone 16'], browserName: 'chromium' } },
    { name: 'iphone-16-dark', use: { ...devices['iPhone 16'], browserName: 'chromium', colorScheme: 'dark' }, testMatch: /appearance\.spec\.ts/ },
    { name: 'desktop', use: { ...devices['Desktop Chrome'] }, testMatch: /smoke\.spec\.ts/ },
  ],
  webServer: {
    command: 'npm run build && npm run preview',
    url: 'http://localhost:4173/',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
