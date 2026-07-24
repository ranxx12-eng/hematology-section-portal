import { test, expect } from '@playwright/test';

test.describe('Authentication', () => {
  test('login page loads', async ({ page }) => {
    await page.goto('/en/login');
    await expect(page.getByRole('heading', { name: /sign in/i })).toBeVisible();
  });

  test('login with demo credentials', async ({ page }) => {
    await page.goto('/en/login');
    await page.fill('#email', 'admin@hematology.local');
    await page.fill('#password', 'Demo@123456');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/en/dashboard', { timeout: 10000 });
    await expect(page.getByText(/dashboard/i).first()).toBeVisible();
  });
});

test.describe('Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/en/login');
    await page.fill('#email', 'admin@hematology.local');
    await page.fill('#password', 'Demo@123456');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/en/dashboard');
  });

  test('displays stat cards', async ({ page }) => {
    await expect(page.getByText(/total samples/i)).toBeVisible();
  });

  test('navigates to employees', async ({ page }) => {
    await page.click('a[href*="/employees"]');
    await page.waitForURL('**/en/employees');
    await expect(page.getByText(/employees/i).first()).toBeVisible();
  });
});
