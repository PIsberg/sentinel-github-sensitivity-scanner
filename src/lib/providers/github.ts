import { GitProvider, RepoInfo } from './types';
import { cleanToken } from './utils';

export class GitHubProvider implements GitProvider {
  readonly name = 'GitHub';
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

  private makeHeaders(token?: string): HeadersInit {
    const auth = this.buildAuthHeader(token);
    return auth ? { Authorization: auth } : {};
  }
}
