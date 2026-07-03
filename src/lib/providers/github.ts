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
      if (!res.ok) throw new Error(this.repoError(owner, repo, res.status));
      const data = await res.json();
      return [{ name: data.name, owner: data.owner.login, default_branch: data.default_branch }];
    } else {
      const repos: RepoInfo[] = [];
      let page = 1;
      // Paginate: owners with more than 100 repos would otherwise be silently truncated.
      for (;;) {
        const res = await fetch(
          `${this.baseUrl}/users/${owner}/repos?per_page=100&sort=updated&page=${page}`,
          { headers }
        );
        if (!res.ok) throw new Error(this.userError(owner, res.status));
        const data: Array<{ name: string; owner: { login: string }; default_branch: string }> = await res.json();
        for (const r of data) {
          repos.push({
            name: r.name,
            owner: r.owner.login,
            default_branch: r.default_branch || 'main',
          });
        }
        if (data.length < 100) break;
        page++;
      }
      return repos;
    }
  }

  private repoError(owner: string, repo: string, status: number): string {
    if (status === 401) return `GitHub: invalid or expired token — update it in the Admin tab`;
    if (status === 404) return `GitHub: repo ${owner}/${repo} not found`;
    if (status === 403) return `GitHub: access forbidden — check token scopes or rate limit (${status})`;
    return `GitHub: failed to fetch repo ${owner}/${repo} (${status})`;
  }

  private userError(owner: string, status: number): string {
    if (status === 401) return `GitHub: invalid or expired token — update it in the Admin tab`;
    if (status === 404) return `GitHub: user or org "${owner}" not found`;
    if (status === 403) return `GitHub: access forbidden — check token scopes or rate limit (${status})`;
    return `GitHub: failed to fetch repos for ${owner} (${status})`;
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
      if (!res.ok) {
        if (res.status === 401) throw new Error(`GitHub: invalid or expired token — update it in the Admin tab`);
        throw new Error(`GitHub: failed to fetch commits (${res.status})`);
      }
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
    type GHFile = { filename: string; patch?: string };
    return ((data as { files?: GHFile[] }).files ?? [])
      .filter((f): f is Required<GHFile> => !!f.patch)
      .map(f => ({ filename: f.filename, patch: f.patch }));
  }

  private makeHeaders(token?: string): HeadersInit {
    const auth = this.buildAuthHeader(token);
    return auth ? { Authorization: auth } : {};
  }
}
