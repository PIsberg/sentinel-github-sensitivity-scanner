import { test, expect } from '@playwright/test';

test.describe('Admin Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/admin');
  });

  // ── Page structure ─────────────────────────────────────────────────────────

  test('shows the Configuration heading', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Configuration', exact: true })).toBeVisible();
  });

  test('shows the Scanning Rules section', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Scanning Rules' })).toBeVisible();
  });

  // ── Default rules ──────────────────────────────────────────────────────────

  test('populates default rules on first load', async ({ page }) => {
    await expect(page.getByText('AWS Access Key ID', { exact: true })).toBeVisible();
    await expect(page.getByText('Private Key', { exact: true })).toBeVisible();
    await expect(page.getByText('Google API Key', { exact: true })).toBeVisible();
    await expect(page.getByText('Generic Password', { exact: true })).toBeVisible();
    await expect(page.getByText('OpenAI API Key', { exact: true })).toBeVisible();
  });

  // ── Add rule ───────────────────────────────────────────────────────────────

  test('Add Rule button opens the rule editor modal', async ({ page }) => {
    await page.getByRole('button', { name: 'Add Rule' }).click();

    await expect(page.getByRole('heading', { name: 'Add New Rule' })).toBeVisible();
    await expect(page.getByPlaceholder('e.g. AWS Access Key')).toBeVisible();
    await expect(page.getByPlaceholder(/AKIA/)).toBeVisible();
  });

  test('can add a new rule and see it in the table', async ({ page }) => {
    await page.getByRole('button', { name: 'Add Rule' }).click();

    await page.getByPlaceholder('e.g. AWS Access Key').fill('My Custom Rule');
    await page.getByPlaceholder(/AKIA/).fill('secret_[a-z]{10}');
    await page.locator('select').selectOption('low');
    await page.getByPlaceholder('What does this rule detect?').fill('Detects custom secrets');

    await page.getByRole('button', { name: 'Save Rule' }).click();

    await expect(page.getByRole('heading', { name: 'Add New Rule' })).not.toBeVisible();
    await expect(page.getByText('My Custom Rule', { exact: true })).toBeVisible();
  });

  test('Cancel closes the editor without saving', async ({ page }) => {
    await page.getByRole('button', { name: 'Add Rule' }).click();
    await page.getByPlaceholder('e.g. AWS Access Key').fill('Should Not Save');

    await page.getByRole('button', { name: 'Cancel' }).click();

    await expect(page.getByRole('heading', { name: 'Add New Rule' })).not.toBeVisible();
    await expect(page.getByText('Should Not Save')).not.toBeVisible();
  });

  // ── Edit rule ──────────────────────────────────────────────────────────────

  test('edit button opens the editor pre-filled with rule data', async ({ page }) => {
    await page.getByTitle('Edit').first().click();

    await expect(page.getByRole('heading', { name: 'Edit Rule' })).toBeVisible();
    // Name field is pre-filled (not empty)
    await expect(page.getByPlaceholder('e.g. AWS Access Key')).not.toHaveValue('');
  });

  test('can rename an existing rule', async ({ page }) => {
    await page.getByTitle('Edit').first().click();

    const nameInput = page.getByPlaceholder('e.g. AWS Access Key');
    await nameInput.clear();
    await nameInput.fill('Renamed Rule');

    await page.getByRole('button', { name: 'Save Rule' }).click();

    await expect(page.getByRole('heading', { name: 'Edit Rule' })).not.toBeVisible();
    await expect(page.getByText('Renamed Rule', { exact: true })).toBeVisible();
  });

  test('X button closes the editor without saving', async ({ page }) => {
    await page.getByTitle('Edit').first().click();
    await page.getByRole('heading', { name: 'Edit Rule' })
      .locator('..').locator('..').getByRole('button').first().click();

    await expect(page.getByRole('heading', { name: 'Edit Rule' })).not.toBeVisible();
  });

  // ── Delete rule ────────────────────────────────────────────────────────────

  test('delete button removes the rule from the table', async ({ page }) => {
    const firstRow = page.locator('tbody tr').first();
    const ruleName = await firstRow.locator('td .font-medium').first().textContent();

    await firstRow.getByTitle('Delete').click();

    await expect(page.getByText(ruleName!, { exact: true })).not.toBeVisible();
  });

  // ── Import / Export ────────────────────────────────────────────────────────

  test('shows Import and Export buttons', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'Export' })).toBeVisible();
    // Import is rendered as a label wrapping a hidden file input
    await expect(page.getByText('Import')).toBeVisible();
  });

  // ── Provider Configuration ─────────────────────────────────────────────────

  test('shows the Provider Configuration section', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Provider Configuration' })).toBeVisible();
  });

  test('shows token sections for all four providers', async ({ page }) => {
    const headings = page.getByRole('heading', { level: 3 });
    await expect(headings.filter({ hasText: 'GitHub' })).toBeVisible();
    await expect(headings.filter({ hasText: 'GitLab' })).toBeVisible();
    await expect(headings.filter({ hasText: 'Bitbucket' })).toBeVisible();
    await expect(headings.filter({ hasText: 'Gitea / Self-hosted' })).toBeVisible();
  });

  test('token form shows Saved confirmation after submitting', async ({ page }) => {
    const githubForm = page.locator('form').filter({ has: page.getByPlaceholder('ghp_...') });

    await githubForm.getByPlaceholder('ghp_...').fill('ghp_testtoken1234567890abcdef');
    await githubForm.getByRole('button', { name: 'Save' }).click();

    await expect(githubForm.getByRole('button', { name: 'Saved' })).toBeVisible({ timeout: 3_000 });
  });

  test('token input has password type by default (hidden)', async ({ page }) => {
    const tokenInput = page.getByPlaceholder('ghp_...').first();
    await expect(tokenInput).toHaveAttribute('type', 'password');
  });

  test('eye icon toggles token visibility', async ({ page }) => {
    const githubForm = page.locator('form').filter({ has: page.getByPlaceholder('ghp_...') });
    const tokenInput = githubForm.getByPlaceholder('ghp_...');
    await tokenInput.fill('ghp_test');

    await expect(tokenInput).toHaveAttribute('type', 'password');
    // Click the show/hide toggle button (eye icon)
    await githubForm.locator('button[type="button"]').click();
    await expect(tokenInput).toHaveAttribute('type', 'text');
  });

  test('Gitea section has an Instance URL field', async ({ page }) => {
    await expect(page.getByPlaceholder('https://gitea.example.com')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Save URL' })).toBeVisible();
  });
});
