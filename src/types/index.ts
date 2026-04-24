export type Severity = 'low' | 'medium' | 'high';

export type GitProviderType = 'github' | 'gitlab' | 'bitbucket' | 'gitea';

export interface ParsedTarget {
  provider: GitProviderType;
  owner: string;
  repo?: string;
  baseUrl?: string;
}

export interface ProviderTokens {
  github: string;
  gitlab: string;
  bitbucket: string;
  gitea: string;
}

export interface Rule {
  id: string;
  name: string;
  pattern: string; // RegExp string
  severity: Severity;
  description: string;
}

export interface CommitInfo {
  sha: string;
  message: string; // first line only
  author: string;
  date: string; // ISO 8601
}

export interface DiffFile {
  filename: string;
  patch: string; // unified diff text; empty string when unavailable
}

export interface ScanResult {
  repo: string;
  file: string;
  ruleId: string;
  match: string;
  line: number;
  commitSha?: string;
  commitMessage?: string;
  commitAuthor?: string;
  commitDate?: string;
}
