import JSZip from 'jszip';
import type { Page } from '@playwright/test';

export async function createZipBuffer(files: Record<string, string>): Promise<Buffer> {
  const zip = new JSZip();
  for (const [name, content] of Object.entries(files)) {
    zip.file(name, content);
  }
  return zip.generateAsync({ type: 'nodebuffer' });
}

/**
 * Mocks the GitHub API and archive proxy for a testuser/test-repo scan.
 * Pass `files` to control the ZIP contents; omit for a clean README-only repo.
 * Pass `slow: true` to add a 1.2s delay on the archive download (for stop-button tests).
 */
export async function mockGitHubScan(
  page: Page,
  options: { files?: Record<string, string>; slow?: boolean } = {}
) {
  const files = options.files ?? {
    'test-repo-main/README.md': '# Test repo\nNo secrets here.',
  };

  await page.route('https://api.github.com/repos/testuser/test-repo', route =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        name: 'test-repo',
        owner: { login: 'testuser' },
        default_branch: 'main',
      }),
    })
  );

  await page.route('**/api/archive/proxy**', async route => {
    if (options.slow) {
      await new Promise(r => setTimeout(r, 1200));
    }
    const zipBuffer = await createZipBuffer(files);
    await route.fulfill({
      status: 200,
      contentType: 'application/zip',
      body: zipBuffer,
    });
  });
}

/** Mocks ALL GitHub API calls to return the given HTTP status (default 404). */
export async function mockGitHubError(page: Page, status = 404) {
  await page.route('https://api.github.com/**', route =>
    route.fulfill({
      status,
      contentType: 'application/json',
      body: JSON.stringify({ message: 'Not Found' }),
    })
  );
}
