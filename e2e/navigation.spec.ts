import { test, expect } from '@playwright/test';

test.describe('Navigation', () => {
  // ── Header presence ────────────────────────────────────────────────────────

  test('header is visible on the scanner page', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('link', { name: /Git Sentinel/ })).toBeVisible();
    await expect(page.getByRole('navigation')).toBeVisible();
  });

  test('header is visible on the admin page', async ({ page }) => {
    await page.goto('/admin');
    await expect(page.getByRole('link', { name: /Git Sentinel/ })).toBeVisible();
    await expect(page.getByRole('navigation')).toBeVisible();
  });

  // ── Active-link highlighting ───────────────────────────────────────────────

  test('Scanner link is highlighted as active on /', async ({ page }) => {
    await page.goto('/');
    const scannerLink = page.getByRole('link', { name: /Scanner/ });
    const adminLink = page.getByRole('link', { name: /Rules & Config/ });

    await expect(scannerLink).toHaveClass(/bg-gray-100/);
    await expect(adminLink).not.toHaveClass(/bg-gray-100/);
  });

  test('Rules & Config link is highlighted as active on /admin', async ({ page }) => {
    await page.goto('/admin');
    const adminLink = page.getByRole('link', { name: /Rules & Config/ });
    const scannerLink = page.getByRole('link', { name: /Scanner/ });

    await expect(adminLink).toHaveClass(/bg-gray-100/);
    await expect(scannerLink).not.toHaveClass(/bg-gray-100/);
  });

  // ── Link navigation ────────────────────────────────────────────────────────

  test('clicking Rules & Config navigates to /admin', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('link', { name: /Rules & Config/ }).click();

    await expect(page).toHaveURL('/admin');
    await expect(page.getByRole('heading', { name: 'Configuration', exact: true })).toBeVisible();
  });

  test('clicking Scanner navigates to /', async ({ page }) => {
    await page.goto('/admin');
    await page.getByRole('link', { name: /Scanner/ }).click();

    await expect(page).toHaveURL('/');
    await expect(page.getByRole('heading', { name: 'Scan for Sensitive Data' })).toBeVisible();
  });

  test('clicking the Git Sentinel logo navigates to /', async ({ page }) => {
    await page.goto('/admin');
    await page.getByRole('link', { name: /Git Sentinel/ }).click();

    await expect(page).toHaveURL('/');
  });

  // ── Sticky header ──────────────────────────────────────────────────────────

  test('header has sticky positioning', async ({ page }) => {
    await page.goto('/admin');
    const header = page.locator('header');
    const position = await header.evaluate(el => window.getComputedStyle(el).position);
    expect(position).toBe('sticky');
  });
});
