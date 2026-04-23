export interface RepoInfo {
  name: string;
  owner: string;
  default_branch: string;
}

export interface GitProvider {
  readonly name: string;
  fetchRepositories(
    owner: string,
    repo: string | undefined,
    token: string | undefined
  ): Promise<RepoInfo[]>;
  getArchiveUrl(owner: string, repo: string, ref: string): string;
  buildAuthHeader(token: string | undefined): string;
}
