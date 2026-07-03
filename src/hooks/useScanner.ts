import { useState, useCallback, useRef } from "react";
import { Rule, ScanResult } from "@/types";
import { fetchRepositories, downloadRepoZip, extractFilesFromZip, scanContent, scanDiff } from "@/lib/scanner";
import { detectProvider, getProvider } from "@/lib/providers/index";
import { useConfig } from "@/contexts/ConfigContext";

interface ScanOptions {
  scanHistory: boolean;
  maxCommits: number;
}

interface Progress {
  status: 'idle' | 'fetching_repos' | 'downloading' | 'scanning' | 'scanning_history' | 'complete' | 'error';
  currentRepo?: string;
  currentFile?: string;
  currentCommit?: string;
  filesScanned: number;
  reposScanned: number;
  bytesScanned: number;
  totalFiles: number;
  percentage: number;
  commitsScanned: number;
  totalCommits: number;
}

export function useScanner(rules: Rule[], scanOptions?: ScanOptions) {
  const { tokens, giteaBaseUrl } = useConfig();
  const [progress, setProgress] = useState<Progress>({
    status: 'idle',
    filesScanned: 0,
    reposScanned: 0,
    bytesScanned: 0,
    totalFiles: 0,
    percentage: 0,
    commitsScanned: 0,
    totalCommits: 0,
  });
  const [results, setResults] = useState<ScanResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const abortRef = useRef<boolean>(false);

  const stopScan = useCallback(() => {
    abortRef.current = true;
  }, []);

  const startScan = useCallback(async (targetUrl: string) => {
    setResults([]);
    setError(null);
    setWarnings([]);
    abortRef.current = false;
    setProgress({
      status: 'fetching_repos',
      filesScanned: 0,
      reposScanned: 0,
      bytesScanned: 0,
      totalFiles: 0,
      percentage: 0,
      commitsScanned: 0,
      totalCommits: 0,
    });

    try {
      const target = detectProvider(targetUrl, giteaBaseUrl);
      if (!target) throw new Error("Invalid URL. Supported: github.com, gitlab.com, bitbucket.org, or any Gitea instance URL.");

      const provider = getProvider(target);
      const token = tokens[target.provider];

      console.log(`[useScanner] Starting scan for: ${targetUrl} (${provider.name})`);
      const repos = await fetchRepositories(target, provider, token);
      if (repos.length === 0) throw new Error("No repositories found.");

      let totalScanned = 0;
      let totalBytes = 0;
      let totalRepos = 0;

      for (const repo of repos) {
        if (abortRef.current) break;

        console.log(`[useScanner] Processing repo: ${repo.name}`);
        setProgress(p => ({ ...p, currentRepo: repo.name, status: 'downloading' }));

        // A single repo failing (missing branch, download error, corrupt zip)
        // should not abort the scan of the remaining repos.
        let zipData: ArrayBuffer;
        let files: Awaited<ReturnType<typeof extractFilesFromZip>>;
        try {
          zipData = await downloadRepoZip(repo.owner, repo.name, repo.default_branch, provider, token);
          if (abortRef.current) break;
          console.log(`[useScanner] Zip downloaded. Extracting...`);
          files = await extractFilesFromZip(zipData);
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          console.warn(`[useScanner] Skipping repo ${repo.name}:`, err);
          setWarnings(prev => [...prev, `Skipped ${repo.owner}/${repo.name}: ${message}`]);
          continue;
        }
        console.log(`[useScanner] Extracted ${files.length} files.`);

        setProgress(p => ({ ...p, status: 'scanning', totalFiles: files.length }));

        for (const file of files) {
          if (abortRef.current) break;

          setProgress(p => ({
            ...p,
            currentFile: file.path,
            filesScanned: totalScanned + 1,
            reposScanned: totalRepos,
            bytesScanned: totalBytes,
          }));

          totalBytes += file.content.length;
          const matches = scanContent(file.content, rules, repo.name, file.path);
          if (matches.length > 0) {
            console.log(`[useScanner] Found ${matches.length} matches in ${file.path}`);
            setResults(prev => [...prev, ...matches]);
          }
          totalScanned++;
        }
        totalRepos++;

        if (scanOptions?.scanHistory && provider.supportsHistoryScan && !abortRef.current) {
          const maxCommits = Math.min(Math.max(1, scanOptions.maxCommits ?? 100), 500);
          setProgress(p => ({ ...p, status: 'scanning_history', commitsScanned: 0, totalCommits: 0 }));
          let commits;
          try {
            commits = await provider.fetchCommits(repo.owner, repo.name, repo.default_branch, maxCommits, token);
          } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            console.warn(`[useScanner] Skipping history scan for ${repo.name}:`, err);
            setWarnings(prev => [...prev, `Skipped history scan for ${repo.owner}/${repo.name}: ${message}`]);
            continue;
          }
          setProgress(p => ({ ...p, totalCommits: commits.length }));
          let commitsScanned = 0;
          for (const commit of commits) {
            if (abortRef.current) break;
            setProgress(p => ({
              ...p,
              currentCommit: commit.sha.slice(0, 7),
              commitsScanned,
            }));
            try {
              const diffFiles = await provider.fetchCommitDiff(repo.owner, repo.name, commit.sha, token);
              const matches = scanDiff(diffFiles, rules, repo.name, commit);
              if (matches.length > 0) setResults(prev => [...prev, ...matches]);
            } catch (err) {
              console.warn(`[useScanner] Skipping commit ${commit.sha}:`, err);
            }
            commitsScanned++;
            await new Promise(r => setTimeout(r, 100));
          }
          setProgress(p => ({ ...p, commitsScanned }));
        }
      }

      if (abortRef.current) {
        console.log(`[useScanner] Scan stopped by user.`);
        setProgress(p => ({ ...p, status: 'complete', currentFile: 'Stopped by user' }));
      } else {
        console.log(`[useScanner] Scan complete. Files: ${totalScanned}`);
        setProgress(p => ({
          ...p,
          status: 'complete',
          percentage: 100,
          filesScanned: totalScanned,
          reposScanned: totalRepos,
          bytesScanned: totalBytes,
        }));
      }
    } catch (err: unknown) {
      console.error("Scan failed", err);
      const errorMessage = err instanceof Error ? err.message : "An error occurred during scanning.";
      setError(errorMessage);
      setProgress(p => ({ ...p, status: 'error' }));
    }
  }, [rules, tokens, giteaBaseUrl, scanOptions]);

  return { progress, results, error, warnings, startScan, stopScan };
}
