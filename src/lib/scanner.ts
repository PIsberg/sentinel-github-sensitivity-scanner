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
    if (raw.startsWith('+') && !raw.startsWith('+++')) {
      newLineNum++;
      result.push({ line: newLineNum, text: raw.slice(1) });
    } else if (!raw.startsWith('-')) {
      newLineNum++;
    }
  }
  return result;
}

export function scanDiff(diffFiles: DiffFile[], rules: Rule[], repo: string, commit: CommitInfo): ScanResult[] {
  const results: ScanResult[] = [];
  for (const file of diffFiles) {
    if (!file.patch) continue;
    const addedLines = extractAddedLines(file.patch);
    rules.forEach(rule => {
      try {
        const regex = new RegExp(rule.pattern, 'g');
        for (const { line, text } of addedLines) {
          if (regex.test(text)) {
            results.push({
              repo,
              file: file.filename,
              ruleId: rule.name,
              match: text.trim().substring(0, 50) + '...',
              line,
              commitSha: commit.sha,
              commitMessage: commit.message,
              commitAuthor: commit.author,
              commitDate: commit.date,
            });
            regex.lastIndex = 0;
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
      const regex = new RegExp(rule.pattern, 'g');
      lines.forEach((line, index) => {
        if (regex.test(line)) {
          results.push({
            repo,
            file: fileName,
            ruleId: rule.name,
            match: line.trim().substring(0, 50) + '...',
            line: index + 1,
          });
          regex.lastIndex = 0;
        }
      });
    } catch (e) {
      console.warn(`Invalid regex pattern for rule ${rule.name}`, e);
    }
  });

  return results;
}
