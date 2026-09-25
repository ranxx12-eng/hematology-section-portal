import { defineConfig, devices } from '@playwright/test';

const baseURL = process.env.PREVIEW_BASE_URL;
if (!baseURL) {
  throw new Error('Set PREVIEW_BASE_URL to the Vercel Preview deployment URL');
}

export default defineConfig({
  testDir: './e2e',
  testMatch: 'form-hema-022-preview.remote.spec.ts',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'off',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
