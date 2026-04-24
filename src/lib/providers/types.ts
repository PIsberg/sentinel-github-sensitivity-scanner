import { CommitInfo, DiffFile } from '@/types';

export interface RepoInfo {
  name: string;
  owner: string;
  default_branch: string;
}

export interface GitProvider {
  readonly name: string;
  readonly supportsHistoryScan: boolean;
  fetchRepositories(
    owner: string,
    repo: string | undefined,
    token: string | undefined
  ): Promise<RepoInfo[]>;
  getArchiveUrl(owner: string, repo: string, ref: string): string;
  buildAuthHeader(token: string | undefined): string;
  fetchCommits(
    owner: string,
    repo: string,
    branch: string,
    maxCommits: number,
    token: string | undefined
  ): Promise<CommitInfo[]>;
  fetchCommitDiff(
    owner: string,
    repo: string,
    sha: string,
    token: string | undefined
  ): Promise<DiffFile[]>;
}
