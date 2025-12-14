import { useState, useCallback, useRef } from "react";
import { Rule, ScanResult } from "@/types";
import { parseGitHubUrl, fetchRepositories, downloadRepoZip, extractFilesFromZip, scanContent } from "@/lib/scanner";
import { useConfig } from "@/contexts/ConfigContext";

interface Progress {
    status: 'idle' | 'fetching_repos' | 'downloading' | 'scanning' | 'complete' | 'error';
    currentRepo?: string;
    currentFile?: string;
    filesScanned: number;
    reposScanned: number;
    bytesScanned: number;
    totalFiles: number;
    percentage: number;
}

export function useScanner(rules: Rule[]) {
    const { githubToken } = useConfig();
    const [progress, setProgress] = useState<Progress>({
        status: 'idle',
        filesScanned: 0,
        reposScanned: 0,
        bytesScanned: 0,
        totalFiles: 0,
        percentage: 0
    });
    const [results, setResults] = useState<ScanResult[]>([]);
    const [error, setError] = useState<string | null>(null);
    const abortRef = useRef<boolean>(false);

    const stopScan = useCallback(() => {
        abortRef.current = true;
    }, []);

    const startScan = useCallback(async (targetUrl: string) => {
        setResults([]);
        setError(null);
        abortRef.current = false;
        setProgress({
            status: 'fetching_repos',
            filesScanned: 0,
            reposScanned: 0,
            bytesScanned: 0,
            totalFiles: 0,
            percentage: 0
        });

        try {
            const target = parseGitHubUrl(targetUrl);
            if (!target) throw new Error("Invalid GitHub URL");

            console.log(`[ScannerHook] Starting scan for: ${targetUrl}`);
            const repos = await fetchRepositories(target, githubToken);
            if (repos.length === 0) throw new Error("No repositories found.");

            let totalScanned = 0;
            let totalBytes = 0;
            let totalRepos = 0;

            for (const repo of repos) {
                if (abortRef.current) break;

                console.log(`[ScannerHook] Processing repo: ${repo.name}`);
                setProgress(p => ({
                    ...p,
                    currentRepo: repo.name,
                    status: 'downloading'
                }));

                const zipData = await downloadRepoZip(repo.owner, repo.name, repo.default_branch, githubToken);

                if (abortRef.current) break;

                console.log(`[ScannerHook] Zip downloaded. Extracting...`);
                const files = await extractFilesFromZip(zipData);
                console.log(`[ScannerHook] Extracted ${files.length} files.`);

                setProgress(p => ({
                    ...p,
                    status: 'scanning',
                    totalFiles: files.length // This is strictly for the current repo really, but good enough
                }));

                for (const file of files) {
                    if (abortRef.current) break;

                    setProgress(p => ({
                        ...p,
                        currentFile: file.path,
                        filesScanned: totalScanned + 1,
                        reposScanned: totalRepos,
                        bytesScanned: totalBytes
                    }));

                    totalBytes += file.content.length;
                    const matches = scanContent(file.content, rules, repo.name, file.path);
                    if (matches.length > 0) {
                        console.log(`[ScannerHook] Found ${matches.length} matches in ${file.path}`);
                        setResults(prev => [...prev, ...matches]);
                    }

                    totalScanned++;
                }
                totalRepos++;
            }

            if (abortRef.current) {
                console.log(`[ScannerHook] Scan stopped by user.`);
                setProgress(p => ({ ...p, status: 'complete', currentFile: 'Stopped by user' }));
            } else {
                console.log(`[ScannerHook] Scan complete. Total files: ${totalScanned}, Total matches: ${results.length}`);
                setProgress(p => ({
                    ...p,
                    status: 'complete',
                    percentage: 100,
                    filesScanned: totalScanned,
                    reposScanned: totalRepos,
                    bytesScanned: totalBytes
                }));
            }

        } catch (err: unknown) {
            console.error("Scan failed", err);
            const errorMessage = err instanceof Error ? err.message : "An error occurred during scanning.";
            setError(errorMessage);
            setProgress(p => ({ ...p, status: 'error' }));
        }
    }, [rules, githubToken]);

    return {
        progress,
        results,
        error,
        startScan,
        stopScan
    };
}
