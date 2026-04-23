import { GitProvider, RepoInfo } from './types';
import { cleanToken } from './utils';

export class BitbucketProvider implements GitProvider {
  readonly name = 'Bitbucket';
  private readonly apiBase = 'https://api.bitbucket.org/2.0';

  buildAuthHeader(token?: string): string {
    const clean = cleanToken(token);
    if (!clean) return '';
    // "username:app_password" → Basic auth; bare token → Bearer
    if (clean.includes(':')) return `Basic ${btoa(clean)}`;
    return `Bearer ${clean}`;
  }

  async fetchRepositories(owner: string, repo?: string, token?: string): Promise<RepoInfo[]> {
    const headers = this.makeHeaders(token);
    if (repo) {
      const res = await fetch(`${this.apiBase}/repositories/${owner}/${repo}`, { headers });
      if (!res.ok) throw new Error(`Bitbucket: repo ${owner}/${repo} not found (${res.status})`);
      const data = await res.json();
      return [{
        name: data.slug,
        owner: data.workspace.slug,
        default_branch: data.mainbranch?.name || 'main',
      }];
    } else {
      const res = await fetch(`${this.apiBase}/repositories/${owner}?pagelen=100`, { headers });
      if (!res.ok) throw new Error(`Bitbucket: workspace ${owner} not found (${res.status})`);
      const data = await res.json();
      return (data.values || []).map((r: any) => ({
        name: r.slug,
        owner: r.workspace.slug,
        default_branch: r.mainbranch?.name || 'main',
      }));
    }
  }

  getArchiveUrl(owner: string, repo: string, ref: string): string {
    return `https://bitbucket.org/${owner}/${repo}/get/${ref}.zip`;
  }

  private makeHeaders(token?: string): HeadersInit {
    const auth = this.buildAuthHeader(token);
    return auth ? { Authorization: auth } : {};
  }
}
