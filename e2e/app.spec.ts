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

  test('mode selector appears after camera starts', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Start' }).click();
    await expect(page.locator('canvas')).toBeVisible({ timeout: 5000 });

    await expect(page.getByRole('button', { name: 'Live' })).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('button', { name: 'Breathe' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Check' })).toBeVisible();
  });

  test('switching to breathe mode shows breathing guide', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Start' }).click();
    await expect(page.locator('canvas')).toBeVisible({ timeout: 5000 });

    await page.getByRole('button', { name: 'Breathe' }).click({ timeout: 10000 });
    await expect(page.getByText('Breathe in')).toBeVisible({ timeout: 3000 });
  });

  test('switching to check mode shows countdown', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Start' }).click();
    await expect(page.locator('canvas')).toBeVisible({ timeout: 5000 });

    await page.getByRole('button', { name: 'Check' }).click({ timeout: 10000 });
    await expect(page.getByText('Sit still and breathe normally')).toBeVisible({ timeout: 3000 });
  });
});
