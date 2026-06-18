import { describe, it, expect } from 'vitest';
import { GitHubProvider } from './github';
import { GitLabProvider } from './gitlab';
import { BitbucketProvider } from './bitbucket';
import { GiteaProvider } from './gitea';

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
