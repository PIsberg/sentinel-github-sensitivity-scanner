import { describe, it, expect } from 'vitest';
import { detectProvider, getProvider } from './index';

describe('detectProvider', () => {
  it('parses "owner/repo" shorthand as GitHub', () => {
    expect(detectProvider('octocat/hello')).toEqual({
      provider: 'github',
      owner: 'octocat',
      repo: 'hello',
    });
  });

  it('parses a bare "owner" shorthand as a GitHub user with no repo', () => {
    expect(detectProvider('octocat')).toEqual({ provider: 'github', owner: 'octocat' });
  });

  it('parses a full github.com URL and strips a trailing slash and .git suffix', () => {
    expect(detectProvider('https://github.com/octocat/hello.git/')).toEqual({
      provider: 'github',
      owner: 'octocat',
      repo: 'hello',
    });
  });

  it('detects gitlab.com and records the base URL', () => {
    expect(detectProvider('https://gitlab.com/group/project')).toEqual({
      provider: 'gitlab',
      owner: 'group',
      repo: 'project',
      baseUrl: 'https://gitlab.com',
    });
  });

  it('treats *.gitlab.com subdomains as GitLab', () => {
    const t = detectProvider('https://git.gitlab.com/group/project');
    expect(t?.provider).toBe('gitlab');
    expect(t?.baseUrl).toBe('https://git.gitlab.com');
  });

  it('detects bitbucket.org', () => {
    expect(detectProvider('https://bitbucket.org/team/repo')).toMatchObject({
      provider: 'bitbucket',
      owner: 'team',
      repo: 'repo',
    });
  });

  it('treats any other host as a self-hosted Gitea instance', () => {
    expect(detectProvider('https://gitea.example.com/user/repo')).toEqual({
      provider: 'gitea',
      owner: 'user',
      repo: 'repo',
      baseUrl: 'https://gitea.example.com',
    });
  });

  it('returns null for empty or owner-less input', () => {
    expect(detectProvider('')).toBeNull();
    expect(detectProvider('https://github.com/')).toBeNull();
  });
});

describe('getProvider', () => {
  it('instantiates the correct provider class per type', () => {
    expect(getProvider({ provider: 'github', owner: 'o' }).name).toBe('GitHub');
    expect(getProvider({ provider: 'gitlab', owner: 'o' }).name).toBe('GitLab');
    expect(getProvider({ provider: 'bitbucket', owner: 'o' }).name).toBe('Bitbucket');
    expect(
      getProvider({ provider: 'gitea', owner: 'o', baseUrl: 'https://g.example.com' }).name
    ).toBe('Gitea');
  });

  it('throws a helpful error when Gitea has no base URL', () => {
    expect(() => getProvider({ provider: 'gitea', owner: 'o' })).toThrow(/Gitea requires a base URL/);
  });
});
