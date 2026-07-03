import { CommitInfo, DiffFile } from '@/types';
import { GitProvider, RepoInfo } from './types';
import { cleanToken } from './utils';

export class GitLabProvider implements GitProvider {
  readonly name = 'GitLab';
  readonly supportsHistoryScan = true;
  private readonly baseUrl: string;

  constructor(baseUrl = 'https://gitlab.com') {
    this.baseUrl = baseUrl.replace(/\/$/, '');
  }

  buildAuthHeader(token?: string): string {
    const clean = cleanToken(token);
    return clean ? `Bearer ${clean}` : '';
  }

  async fetchRepositories(owner: string, repo?: string, token?: string): Promise<RepoInfo[]> {
    const headers = this.makeHeaders(token);
    if (repo) {
      const encoded = encodeURIComponent(`${owner}/${repo}`);
      const res = await fetch(`${this.baseUrl}/api/v4/projects/${encoded}`, { headers });
      if (!res.ok) throw new Error(`GitLab: project ${owner}/${repo} not found (${res.status})`);
      const data = await res.json();
      return [{
        name: data.path,
        owner: data.namespace.path,
        default_branch: data.default_branch || 'main',
      }];
    } else {
      const repos: RepoInfo[] = [];
      let page = 1;
      // Paginate: owners with more than 100 projects would otherwise be silently truncated.
      for (;;) {
        const res = await fetch(
          `${this.baseUrl}/api/v4/users/${owner}/projects?per_page=100&page=${page}`,
          { headers }
        );
        if (!res.ok) throw new Error(`GitLab: user ${owner} not found (${res.status})`);
        const data: Array<{ path: string; namespace: { path: string }; default_branch: string }> = await res.json();
        for (const p of data) {
          repos.push({
            name: p.path,
            owner: p.namespace.path,
            default_branch: p.default_branch || 'main',
          });
        }
        if (data.length < 100) break;
        page++;
      }
      return repos;
    }
  }

  getArchiveUrl(owner: string, repo: string, ref: string): string {
    const encoded = encodeURIComponent(`${owner}/${repo}`);
    return `${this.baseUrl}/api/v4/projects/${encoded}/repository/archive.zip?sha=${ref}`;
  }

  async fetchCommits(owner: string, repo: string, branch: string, maxCommits: number, token?: string): Promise<CommitInfo[]> {
    const headers = this.makeHeaders(token);
    const encoded = encodeURIComponent(`${owner}/${repo}`);
    const commits: CommitInfo[] = [];
    let page = 1;
    while (commits.length < maxCommits) {
      const remaining = maxCommits - commits.length;
      const perPage = Math.min(100, remaining);
      const res = await fetch(
        `${this.baseUrl}/api/v4/projects/${encoded}/repository/commits?ref_name=${branch}&per_page=${perPage}&page=${page}`,
        { headers }
      );
      if (!res.ok) throw new Error(`GitLab: failed to fetch commits (${res.status})`);
      const data = await res.json();
      if (!data.length) break;
      for (const c of data) {
        commits.push({
          sha: c.id,
          message: (c.title as string).split('\n')[0],
          author: c.author_name ?? 'unknown',
          date: c.authored_date ?? '',
        });
      }
      if (data.length < perPage) break;
      page++;
    }
    return commits;
  }

  async fetchCommitDiff(owner: string, repo: string, sha: string, token?: string): Promise<DiffFile[]> {
    const headers = this.makeHeaders(token);
    const encoded = encodeURIComponent(`${owner}/${repo}`);
    const res = await fetch(
      `${this.baseUrl}/api/v4/projects/${encoded}/repository/commits/${sha}/diff`,
      { headers }
    );
    if (!res.ok) throw new Error(`GitLab: failed to fetch diff for ${sha} (${res.status})`);
    const data: Array<{ new_path: string; diff: string }> = await res.json();
    return data.map(f => ({ filename: f.new_path, patch: f.diff }));
  }

  private makeHeaders(token?: string): HeadersInit {
    const auth = this.buildAuthHeader(token);
    return auth ? { Authorization: auth } : {};
  }
}
