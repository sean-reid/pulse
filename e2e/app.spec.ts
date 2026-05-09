import { test, expect } from '@playwright/test';

test.describe('pulse app', () => {
  test('landing page shows title and start button', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('h1')).toHaveText('pulse');
    await expect(page.getByRole('button', { name: 'Start' })).toBeVisible();
  });

  test('start button requests camera and shows video', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Start' }).click();

    await expect(page.locator('canvas')).toBeVisible({ timeout: 5000 });
  });
});
