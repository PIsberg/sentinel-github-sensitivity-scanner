import { describe, it, expect, vi, afterEach } from 'vitest';
import { GitHubProvider } from './github';
import { GitLabProvider } from './gitlab';
import { BitbucketProvider } from './bitbucket';
import { GiteaProvider } from './gitea';

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('GitHubProvider', () => {
  const p = new GitHubProvider();

  it('builds a Bearer auth header, or empty string without a token', () => {
    expect(p.buildAuthHeader('abc')).toBe('Bearer abc');
    expect(p.buildAuthHeader('token abc')).toBe('Bearer abc'); // prefix cleaned first
    expect(p.buildAuthHeader(undefined)).toBe('');
  });

  it('points the archive URL at the zipball endpoint', () => {
    expect(p.getArchiveUrl('o', 'r', 'main')).toBe(
      'https://api.github.com/repos/o/r/zipball/main'
    );
  });

  it('supports history scanning', () => {
    expect(p.supportsHistoryScan).toBe(true);
  });
});

describe('GitLabProvider', () => {
  it('URL-encodes the owner/repo path and trims a trailing slash on the base URL', () => {
    const p = new GitLabProvider('https://gitlab.com/');
    expect(p.getArchiveUrl('group', 'proj', 'main')).toBe(
      'https://gitlab.com/api/v4/projects/group%2Fproj/repository/archive.zip?sha=main'
    );
  });
});

describe('BitbucketProvider', () => {
  const p = new BitbucketProvider();

  it('uses Basic auth for "username:app_password" and Bearer for a bare token', () => {
    expect(p.buildAuthHeader('user:pass')).toBe(`Basic ${btoa('user:pass')}`);
    expect(p.buildAuthHeader('baretoken')).toBe('Bearer baretoken');
  });

  it('builds the get-archive URL on bitbucket.org', () => {
    expect(p.getArchiveUrl('team', 'repo', 'main')).toBe(
      'https://bitbucket.org/team/repo/get/main.zip'
    );
  });
});

describe('repository listing pagination', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('GitHub: fetches all pages when an owner has more than 100 repos', async () => {
    const page1 = Array.from({ length: 100 }, (_, i) => ({
      name: `repo-${i}`,
      owner: { login: 'octo' },
      default_branch: 'main',
    }));
    const page2 = [{ name: 'repo-100', owner: { login: 'octo' }, default_branch: 'main' }];
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse(page1))
      .mockResolvedValueOnce(jsonResponse(page2));
    vi.stubGlobal('fetch', fetchMock);

    const repos = await new GitHubProvider().fetchRepositories('octo', undefined, undefined);

    expect(repos).toHaveLength(101);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0][0]).toContain('page=1');
    expect(fetchMock.mock.calls[1][0]).toContain('page=2');
  });

  it('GitHub: stops after one request for a short page', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      jsonResponse([{ name: 'only', owner: { login: 'octo' }, default_branch: 'main' }])
    );
    vi.stubGlobal('fetch', fetchMock);

    const repos = await new GitHubProvider().fetchRepositories('octo', undefined, undefined);

    expect(repos).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('GitLab: fetches all pages when an owner has more than 100 projects', async () => {
    const page1 = Array.from({ length: 100 }, (_, i) => ({
      path: `proj-${i}`,
      namespace: { path: 'group' },
      default_branch: 'main',
    }));
    const page2 = [{ path: 'proj-100', namespace: { path: 'group' }, default_branch: 'main' }];
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse(page1))
      .mockResolvedValueOnce(jsonResponse(page2));
    vi.stubGlobal('fetch', fetchMock);

    const repos = await new GitLabProvider().fetchRepositories('group', undefined, undefined);

    expect(repos).toHaveLength(101);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('Gitea: fetches all pages using the 50-repo page size', async () => {
    const page1 = Array.from({ length: 50 }, (_, i) => ({
      name: `repo-${i}`,
      owner: { login: 'u' },
      default_branch: 'main',
    }));
    const page2 = [{ name: 'repo-50', owner: { login: 'u' }, default_branch: 'main' }];
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse(page1))
      .mockResolvedValueOnce(jsonResponse(page2));
    vi.stubGlobal('fetch', fetchMock);

    const repos = await new GiteaProvider('https://gitea.example.com').fetchRepositories('u', undefined, undefined);

    expect(repos).toHaveLength(51);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('Bitbucket: follows next-page links until exhausted', async () => {
    const repo = (slug: string) => ({ slug, workspace: { slug: 'ws' }, mainbranch: { name: 'main' } });
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ values: [repo('a')], next: 'https://api.bitbucket.org/2.0/repositories/ws?page=2' }))
      .mockResolvedValueOnce(jsonResponse({ values: [repo('b')] }));
    vi.stubGlobal('fetch', fetchMock);

    const repos = await new BitbucketProvider().fetchRepositories('ws', undefined, undefined);

    expect(repos.map(r => r.name)).toEqual(['a', 'b']);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1][0]).toContain('page=2');
  });
});

describe('GiteaProvider', () => {
  const p = new GiteaProvider('https://gitea.example.com/');

  it('builds a "token" auth header', () => {
    expect(p.buildAuthHeader('abc')).toBe('token abc');
    expect(p.buildAuthHeader('')).toBe('');
  });

  it('trims the trailing slash from the base URL in the archive URL', () => {
    expect(p.getArchiveUrl('u', 'r', 'main')).toBe(
      'https://gitea.example.com/api/v1/repos/u/r/archive/main.zip'
    );
  });

  it('does not support history scanning and rejects commit fetches', async () => {
    expect(p.supportsHistoryScan).toBe(false);
    await expect(p.fetchCommits('u', 'r', 'main', 10, undefined)).rejects.toThrow(
      /not supported/
    );
  });
});
