import { CommitInfo, DiffFile } from '@/types';
import { GitProvider, RepoInfo } from './types';
import { cleanToken } from './utils';

export class GitHubProvider implements GitProvider {
  readonly name = 'GitHub';
  readonly supportsHistoryScan = true;
  private readonly baseUrl = 'https://api.github.com';

  buildAuthHeader(token?: string): string {
    const clean = cleanToken(token);
    return clean ? `Bearer ${clean}` : '';
  }

  async fetchRepositories(owner: string, repo?: string, token?: string): Promise<RepoInfo[]> {
    const headers = this.makeHeaders(token);
    if (repo) {
      const res = await fetch(`${this.baseUrl}/repos/${owner}/${repo}`, { headers });
      if (!res.ok) throw new Error(`GitHub: repo ${owner}/${repo} not found (${res.status})`);
      const data = await res.json();
      return [{ name: data.name, owner: data.owner.login, default_branch: data.default_branch }];
    } else {
      const res = await fetch(
        `${this.baseUrl}/users/${owner}/repos?per_page=100&sort=updated`,
        { headers }
      );
      if (!res.ok) throw new Error(`GitHub: user ${owner} not found (${res.status})`);
      const data = await res.json();
      return data.map((r: any) => ({
        name: r.name,
        owner: r.owner.login,
        default_branch: r.default_branch || 'main',
      }));
    }
  }

  getArchiveUrl(owner: string, repo: string, ref: string): string {
    return `${this.baseUrl}/repos/${owner}/${repo}/zipball/${ref}`;
  }

  async fetchCommits(owner: string, repo: string, branch: string, maxCommits: number, token?: string): Promise<CommitInfo[]> {
    const headers = this.makeHeaders(token);
    const commits: CommitInfo[] = [];
    let page = 1;
    while (commits.length < maxCommits) {
      const remaining = maxCommits - commits.length;
      const perPage = Math.min(100, remaining);
      const res = await fetch(
        `${this.baseUrl}/repos/${owner}/${repo}/commits?sha=${branch}&per_page=${perPage}&page=${page}`,
        { headers }
      );
      if (!res.ok) throw new Error(`GitHub: failed to fetch commits (${res.status})`);
      const data = await res.json();
      if (!data.length) break;
      for (const c of data) {
        commits.push({
          sha: c.sha,
          message: (c.commit.message as string).split('\n')[0],
          author: c.commit.author?.name ?? c.commit.committer?.name ?? 'unknown',
          date: c.commit.author?.date ?? c.commit.committer?.date ?? '',
        });
      }
      if (data.length < perPage) break;
      page++;
    }
    return commits;
  }

  async fetchCommitDiff(owner: string, repo: string, sha: string, token?: string): Promise<DiffFile[]> {
    const headers = this.makeHeaders(token);
    const res = await fetch(`${this.baseUrl}/repos/${owner}/${repo}/commits/${sha}`, { headers });
    if (!res.ok) throw new Error(`GitHub: failed to fetch commit ${sha} (${res.status})`);
    const data = await res.json();
    return (data.files ?? [])
      .filter((f: any) => f.patch)
      .map((f: any) => ({ filename: f.filename as string, patch: f.patch as string }));
  }

  private makeHeaders(token?: string): HeadersInit {
    const auth = this.buildAuthHeader(token);
    return auth ? { Authorization: auth } : {};
  }
}
