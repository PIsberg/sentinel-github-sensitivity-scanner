import { ParsedTarget } from '@/types';
import { GitProvider } from './types';
import { GitHubProvider } from './github';
import { GitLabProvider } from './gitlab';
import { BitbucketProvider } from './bitbucket';
import { GiteaProvider } from './gitea';

export function detectProvider(url: string, giteaBaseUrl?: string): ParsedTarget | null {
  const cleaned = url.trim().replace(/\/$/, '').replace(/\.git$/, '');

  let parsed: URL;
  try {
    parsed = new URL(cleaned);
  } catch {
    // Shorthand "owner/repo" or "owner" — assume GitHub
    const parts = cleaned.split('/').filter(Boolean);
    if (parts.length === 2) return { provider: 'github', owner: parts[0], repo: parts[1] };
    if (parts.length === 1) return { provider: 'github', owner: parts[0] };
    return null;
  }

  const host = parsed.hostname.toLowerCase();
  const pathParts = parsed.pathname.split('/').filter(Boolean);
  const owner = pathParts[0];
  const repo = pathParts[1];

  if (!owner) return null;

  if (host === 'github.com') {
    return { provider: 'github', owner, repo };
  }

  if (host === 'gitlab.com' || host.endsWith('.gitlab.com')) {
    return {
      provider: 'gitlab',
      owner,
      repo,
      baseUrl: `${parsed.protocol}//${parsed.host}`,
    };
  }

  if (host === 'bitbucket.org') {
    return { provider: 'bitbucket', owner, repo };
  }

  // Any other host: treat as Gitea self-hosted
  return {
    provider: 'gitea',
    owner,
    repo,
    baseUrl: `${parsed.protocol}//${parsed.host}`,
  };
}

export function getProvider(target: ParsedTarget): GitProvider {
  switch (target.provider) {
    case 'github':
      return new GitHubProvider();
    case 'gitlab':
      return new GitLabProvider(target.baseUrl);
    case 'bitbucket':
      return new BitbucketProvider();
    case 'gitea':
      if (!target.baseUrl) throw new Error('Gitea requires a base URL. Enter a full URL (e.g. https://gitea.example.com/user/repo) or configure the Gitea instance URL in Admin.');
      return new GiteaProvider(target.baseUrl);
  }
}

export type { GitProvider, RepoInfo } from './types';
