export type Severity = 'low' | 'medium' | 'high';

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
