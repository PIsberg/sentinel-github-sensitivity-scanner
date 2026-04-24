import { CommitInfo, DiffFile } from '@/types';
import { GitProvider, RepoInfo } from './types';
import { cleanToken, parseUnifiedDiff } from './utils';

export class BitbucketProvider implements GitProvider {
  readonly name = 'Bitbucket';
  readonly supportsHistoryScan = true;
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
      type BBRepo = { slug: string; workspace: { slug: string }; mainbranch?: { name: string } };
      return ((data as { values?: BBRepo[] }).values || []).map(r => ({
        name: r.slug,
        owner: r.workspace.slug,
        default_branch: r.mainbranch?.name || 'main',
      }));
    }
  }

  getArchiveUrl(owner: string, repo: string, ref: string): string {
    return `https://bitbucket.org/${owner}/${repo}/get/${ref}.zip`;
  }

  async fetchCommits(owner: string, repo: string, branch: string, maxCommits: number, token?: string): Promise<CommitInfo[]> {
    const headers = this.makeHeaders(token);
    const commits: CommitInfo[] = [];
    let url: string | null = `${this.apiBase}/repositories/${owner}/${repo}/commits/${branch}?pagelen=100`;
    while (url && commits.length < maxCommits) {
      const res: Response = await fetch(url, { headers });
      if (!res.ok) throw new Error(`Bitbucket: failed to fetch commits (${res.status})`);
      type BBCommit = { hash: string; message: string; author?: { user?: { display_name?: string }; raw?: string }; date?: string };
      const data: { values?: BBCommit[]; next?: string } = await res.json();
      for (const c of (data.values ?? [])) {
        if (commits.length >= maxCommits) break;
        commits.push({
          sha: c.hash,
          message: (c.message as string).split('\n')[0],
          author: c.author?.user?.display_name ?? c.author?.raw ?? 'unknown',
          date: c.date ?? '',
        });
      }
      url = data.next ?? null;
    }
    return commits;
  }

  async fetchCommitDiff(owner: string, repo: string, sha: string, token?: string): Promise<DiffFile[]> {
    const headers = this.makeHeaders(token);
    const res = await fetch(`${this.apiBase}/repositories/${owner}/${repo}/diff/${sha}`, { headers });
    if (!res.ok) throw new Error(`Bitbucket: failed to fetch diff for ${sha} (${res.status})`);
    const rawDiff = await res.text();
    return parseUnifiedDiff(rawDiff);
  }

  private makeHeaders(token?: string): HeadersInit {
    const auth = this.buildAuthHeader(token);
    return auth ? { Authorization: auth } : {};
  }
}
