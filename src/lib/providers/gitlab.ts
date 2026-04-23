import { GitProvider, RepoInfo } from './types';
import { cleanToken } from './utils';

export class GitLabProvider implements GitProvider {
  readonly name = 'GitLab';
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
      const res = await fetch(
        `${this.baseUrl}/api/v4/users/${owner}/projects?per_page=100`,
        { headers }
      );
      if (!res.ok) throw new Error(`GitLab: user ${owner} not found (${res.status})`);
      const data = await res.json();
      return data.map((p: any) => ({
        name: p.path,
        owner: p.namespace.path,
        default_branch: p.default_branch || 'main',
      }));
    }
  }

  getArchiveUrl(owner: string, repo: string, ref: string): string {
    const encoded = encodeURIComponent(`${owner}/${repo}`);
    return `${this.baseUrl}/api/v4/projects/${encoded}/repository/archive.zip?sha=${ref}`;
  }

  private makeHeaders(token?: string): HeadersInit {
    const auth = this.buildAuthHeader(token);
    return auth ? { Authorization: auth } : {};
  }
}
