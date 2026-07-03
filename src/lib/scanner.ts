import { Rule, ScanResult, ParsedTarget, CommitInfo, DiffFile } from "@/types";
import { GitProvider } from "@/lib/providers/types";
import JSZip from "jszip";

export type { RepoInfo } from "@/lib/providers/types";

export interface ExtractedFile {
  path: string;
  content: string;
}

export async function fetchRepositories(
  target: ParsedTarget,
  provider: GitProvider,
  token?: string
) {
  return provider.fetchRepositories(target.owner, target.repo, token);
}

export async function downloadRepoZip(
  owner: string,
  repo: string,
  branch: string,
  provider: GitProvider,
  token?: string
): Promise<ArrayBuffer> {
  const archiveUrl = provider.getArchiveUrl(owner, repo, branch);
  const authValue = provider.buildAuthHeader(token);

  const params = new URLSearchParams({ url: archiveUrl });
  const headers: Record<string, string> = {};
  if (authValue) headers['Authorization'] = authValue;

  const response = await fetch(`/api/archive/proxy?${params.toString()}`, { headers });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || `Download failed: ${response.status} ${response.statusText}`);
  }
  return response.arrayBuffer();
}

export async function extractFilesFromZip(zipData: ArrayBuffer): Promise<ExtractedFile[]> {
  const zip = new JSZip();
  const loadedZip = await zip.loadAsync(zipData);
  const files: ExtractedFile[] = [];

  for (const [relativePath, fileEntry] of Object.entries(loadedZip.files)) {
    if (!fileEntry.dir) {
      if (relativePath.match(/\.(png|jpg|jpeg|gif|ico|pdf|zip|tar|gz|exe|dll|woff|woff2|ttf|eot)$/i)) {
        continue;
      }
      const content = await fileEntry.async("string");
      files.push({ path: relativePath, content });
    }
  }
  return files;
}

export function extractAddedLines(patch: string): Array<{ line: number; text: string }> {
  const result: Array<{ line: number; text: string }> = [];
  let newLineNum = 0;
  for (const raw of patch.split('\n')) {
    const hunk = raw.match(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
    if (hunk) {
      newLineNum = parseInt(hunk[1], 10) - 1;
      continue;
    }
    // "\ No newline at end of file" is a marker, not a real line — ignore it
    // so it doesn't inflate the line numbers of the added lines that follow.
    if (raw.startsWith('\\')) continue;
    if (raw.startsWith('+') && !raw.startsWith('+++')) {
      newLineNum++;
      result.push({ line: newLineNum, text: raw.slice(1) });
    } else if (!raw.startsWith('-')) {
      newLineNum++;
    }
  }
  return result;
}

// Converts PCRE-style inline flags like (?i) to JS RegExp flags and strips them from the pattern.
export function buildRegex(pattern: string, baseFlags: string): RegExp {
  let flags = baseFlags;
  const cleaned = pattern.replace(/\(\?([ims]+)\)/g, (_, f: string) => {
    for (const c of f) {
      if (!flags.includes(c)) flags += c;
    }
    return '';
  });
  return new RegExp(cleaned, flags);
}

// Builds the short, human-readable match preview shown in results. Only appends
// an ellipsis when the line was actually truncated.
function formatMatch(text: string): string {
  const trimmed = text.trim();
  return trimmed.length > 50 ? `${trimmed.substring(0, 50)}...` : trimmed;
}

// Documentation placeholders and test scaffolding that look like secrets but are
// not. Tested against the *matched secret itself* (not the whole line) so a real
// key on a line that merely mentions "example" is still reported.
const PLACEHOLDER_RE =
  /example|x{4,}|0{6,}|1234567890|placeholder|change[_-]?me|dummy|redacted|your[_-]?(?:api[_-]?)?(?:key|token|secret)|<[a-z0-9_ -]+>|\*{4,}/i;

function isPlaceholder(matched: string): boolean {
  return PLACEHOLDER_RE.test(matched);
}

// Runs a rule's regex against a single line and returns the matched text, or
// null when there is no match or the match is a known placeholder. Resets
// lastIndex so the global-flagged regex can be reused across lines.
function matchRule(regex: RegExp, line: string): string | null {
  regex.lastIndex = 0;
  const m = regex.exec(line);
  if (!m || isPlaceholder(m[0])) return null;
  return m[0];
}

export function scanDiff(diffFiles: DiffFile[], rules: Rule[], repo: string, commit: CommitInfo): ScanResult[] {
  const results: ScanResult[] = [];
  for (const file of diffFiles) {
    if (!file.patch) continue;
    const addedLines = extractAddedLines(file.patch);
    rules.forEach(rule => {
      try {
        const regex = buildRegex(rule.pattern, 'g');
        for (const { line, text } of addedLines) {
          if (matchRule(regex, text)) {
            results.push({
              repo,
              file: file.filename,
              ruleId: rule.name,
              severity: rule.severity,
              match: formatMatch(text),
              line,
              commitSha: commit.sha,
              commitMessage: commit.message,
              commitAuthor: commit.author,
              commitDate: commit.date,
            });
          }
        }
      } catch (e) {
        console.warn(`Invalid regex pattern for rule ${rule.name}`, e);
      }
    });
  }
  return results;
}

export function scanContent(content: string, rules: Rule[], repo: string, fileName: string): ScanResult[] {
  const results: ScanResult[] = [];
  const lines = content.split('\n');

  rules.forEach(rule => {
    try {
      const regex = buildRegex(rule.pattern, 'g');
      lines.forEach((line, index) => {
        if (matchRule(regex, line)) {
          results.push({
            repo,
            file: fileName,
            ruleId: rule.name,
            severity: rule.severity,
            match: formatMatch(line),
            line: index + 1,
          });
        }
      });
    } catch (e) {
      console.warn(`Invalid regex pattern for rule ${rule.name}`, e);
    }
  });

  return results;
}
