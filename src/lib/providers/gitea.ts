import { CommitInfo, DiffFile } from '@/types';
import { GitProvider, RepoInfo } from './types';
import { cleanToken } from './utils';

export class GiteaProvider implements GitProvider {
  readonly name = 'Gitea';
  readonly supportsHistoryScan = false;
  private readonly baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
  }

  buildAuthHeader(token?: string): string {
    const clean = cleanToken(token);
    return clean ? `token ${clean}` : '';
  }

  async fetchRepositories(owner: string, repo?: string, token?: string): Promise<RepoInfo[]> {
    const headers = this.makeHeaders(token);
    if (repo) {
      const res = await fetch(`${this.baseUrl}/api/v1/repos/${owner}/${repo}`, { headers });
      if (!res.ok) throw new Error(`Gitea: repo ${owner}/${repo} not found (${res.status})`);
      const data = await res.json();
      return [{
        name: data.name,
        owner: data.owner.login,
        default_branch: data.default_branch || 'main',
      }];
    } else {
      const res = await fetch(`${this.baseUrl}/api/v1/users/${owner}/repos?limit=50`, { headers });
      if (!res.ok) throw new Error(`Gitea: user ${owner} not found (${res.status})`);
      const data: Array<{ name: string; owner: { login: string }; default_branch: string }> = await res.json();
      return data.map(r => ({
        name: r.name,
        owner: r.owner.login,
        default_branch: r.default_branch || 'main',
      }));
    }
  }

  getArchiveUrl(owner: string, repo: string, ref: string): string {
    return `${this.baseUrl}/api/v1/repos/${owner}/${repo}/archive/${ref}.zip`;
  }

  fetchCommits(_owner: string, _repo: string, _branch: string, _maxCommits: number, _token?: string): Promise<CommitInfo[]> {
    throw new Error('Gitea history scan is not supported');
  }

  fetchCommitDiff(_owner: string, _repo: string, _sha: string, _token?: string): Promise<DiffFile[]> {
    throw new Error('Gitea history scan is not supported');
  }

  private makeHeaders(token?: string): HeadersInit {
    const auth = this.buildAuthHeader(token);
    return auth ? { Authorization: auth } : {};
  }
}
