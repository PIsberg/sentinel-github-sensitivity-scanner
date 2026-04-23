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

export interface ScanResult {
  repo: string;
  file: string;
  ruleId: string;
  match: string;
  line: number;
}
