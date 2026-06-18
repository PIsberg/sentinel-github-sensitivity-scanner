import { test, expect } from '@playwright/test';
import { mockGitHubScan, mockGitHubError } from './helpers/mock-api';

test.describe('Scanner Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  // ── Static layout ──────────────────────────────────────────────────────────

  test('shows heading and URL input', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Scan for Sensitive Data' })).toBeVisible();
    await expect(page.getByPlaceholder(/github\.com\/user/)).toBeVisible();
  });

  test('Scan Now button is disabled when input is empty', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'Scan Now' })).toBeDisabled();
  });

  test('Scan Now button is enabled once input has text', async ({ page }) => {
    await page.getByPlaceholder(/github\.com\/user/).fill('testuser/test-repo');
    await expect(page.getByRole('button', { name: 'Scan Now' })).toBeEnabled();
  });

  // ── Scan history controls ──────────────────────────────────────────────────

  test('scan history checkbox is unchecked by default', async ({ page }) => {
    await expect(page.getByLabel('Scan git history')).not.toBeChecked();
  });

  test('checking scan history reveals max-commits input with default 100', async ({ page }) => {
    await expect(page.getByLabel(/Max commits/)).not.toBeVisible();
    await page.getByLabel('Scan git history').check();
    await expect(page.getByLabel(/Max commits/)).toBeVisible();
    await expect(page.getByLabel(/Max commits/)).toHaveValue('100');
  });

  test('unchecking scan history hides max-commits input', async ({ page }) => {
    await page.getByLabel('Scan git history').check();
    await page.getByLabel('Scan git history').uncheck();
    await expect(page.getByLabel(/Max commits/)).not.toBeVisible();
  });

  test('max-commits input clamps to 500 when given a higher value', async ({ page }) => {
    await page.getByLabel('Scan git history').check();
    const input = page.getByLabel(/Max commits/);
    await input.fill('9999');
    await expect(input).toHaveValue('500');
  });

  // ── Scan flows (mocked network) ────────────────────────────────────────────

  test('completes scan and reports clean on a secret-free repo', async ({ page }) => {
    await mockGitHubScan(page, {
      files: { 'test-repo-main/README.md': '# Clean\nNothing sensitive here.' },
    });

    await page.getByPlaceholder(/github\.com\/user/).fill('testuser/test-repo');
    await page.getByRole('button', { name: 'Scan Now' }).click();

    await expect(page.getByText('0 Issues Found')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('Clean Scan!')).toBeVisible();
  });

  test('completes scan and reports a finding when a secret is present', async ({ page }) => {
    await mockGitHubScan(page, {
      files: {
        // Matches the default "AWS Access Key ID" rule. Avoids the literal
        // "EXAMPLE" so it isn't suppressed by the placeholder allowlist.
        'test-repo-main/.env': 'AWS_ACCESS_KEY_ID=AKIAIOSFODNN7ABCD123\n',
      },
    });

    await page.getByPlaceholder(/github\.com\/user/).fill('testuser/test-repo');
    await page.getByRole('button', { name: 'Scan Now' }).click();

    await expect(page.getByText('1 Issue Found')).toBeVisible({ timeout: 15_000 });
    // Rule ID badge appears in the result row
    await expect(page.getByText('AWS Access Key ID', { exact: true }).first()).toBeVisible();
    // The matched line is shown in the code block
    await expect(page.getByText(/AKIAIOSFODNN7ABCD123/)).toBeVisible();
  });

  test('shows repo / file / KB stats after a completed scan', async ({ page }) => {
    await mockGitHubScan(page, {
      files: { 'test-repo-main/index.ts': 'const x = 1;' },
    });

    await page.getByPlaceholder(/github\.com\/user/).fill('testuser/test-repo');
    await page.getByRole('button', { name: 'Scan Now' }).click();

    await expect(page.getByText('Scan Results')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/\d+ Repos/)).toBeVisible();
    await expect(page.getByText(/\d+ Files/)).toBeVisible();
  });

  test('Stop button appears while scanning and halts the run', async ({ page }) => {
    await mockGitHubScan(page, { slow: true });

    await page.getByPlaceholder(/github\.com\/user/).fill('testuser/test-repo');
    await page.getByRole('button', { name: 'Scan Now' }).click();

    const stopBtn = page.getByRole('button', { name: 'Stop' });
    await expect(stopBtn).toBeVisible({ timeout: 5_000 });
    await stopBtn.click();

    // After the in-flight download resolves the scan transitions to complete
    await expect(stopBtn).not.toBeVisible({ timeout: 10_000 });
  });

  test('progress indicator is visible while scanning', async ({ page }) => {
    await mockGitHubScan(page, { slow: true });

    await page.getByPlaceholder(/github\.com\/user/).fill('testuser/test-repo');
    await page.getByRole('button', { name: 'Scan Now' }).click();

    await expect(
      page.getByText(/Scanning in progress|Downloading repository/)
    ).toBeVisible({ timeout: 5_000 });

    // Clean up – stop the scan so the test doesn't linger
    await page.getByRole('button', { name: 'Stop' }).click();
  });

  // ── Error handling ─────────────────────────────────────────────────────────

  test('shows an error message when the GitHub API returns 404', async ({ page }) => {
    await mockGitHubError(page, 404);

    await page.getByPlaceholder(/github\.com\/user/).fill('testuser/test-repo');
    await page.getByRole('button', { name: 'Scan Now' }).click();

    await expect(page.getByText(/not found/i)).toBeVisible({ timeout: 10_000 });
  });
});
