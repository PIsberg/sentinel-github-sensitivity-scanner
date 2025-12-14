import { Octokit } from "octokit";
import { Rule, ScanResult } from "@/types";
import JSZip from "jszip";

const octokit = new Octokit();

// Helper to determine if input is a user or a repo
export function parseGitHubUrl(url: string): { owner: string; repo?: string } | null {
    try {
        const cleaned = url.replace(/\/$/, "").replace(/\.git$/, "");
        const parts = new URL(cleaned).pathname.split("/").filter(Boolean);

        if (parts.length >= 2) {
            return { owner: parts[0], repo: parts[1] };
        } else if (parts.length === 1) {
            return { owner: parts[0] };
        }
        return null;
    } catch {
        const parts = url.split("/");
        if (parts.length === 2) return { owner: parts[0], repo: parts[1] };
        if (parts.length === 1) return { owner: parts[0] };
        return null;
    }
}

export interface RepoInfo {
    name: string;
    owner: string;
    default_branch: string;
}

// Helper to clean token and format header
function getAuthHeader(token?: string): { Authorization?: string } {
    if (!token || !token.trim()) return {};

    // Clean up the token: remove "Bearer ", "token ", and whitespace
    let cleanToken = token.trim();
    if (cleanToken.toLowerCase().startsWith('bearer ')) {
        cleanToken = cleanToken.substring(7).trim();
    } else if (cleanToken.toLowerCase().startsWith('token ')) {
        cleanToken = cleanToken.substring(6).trim();
    }

    if (!cleanToken) return {};

    // GitHub API accepts Bearer for both classic and fine-grained tokens
    return { Authorization: `Bearer ${cleanToken}` };
}

export async function fetchRepositories(target: { owner: string; repo?: string }, token?: string): Promise<RepoInfo[]> {
    console.log(`[Scanner] Fetching repositories for target:`, target);
    const headers = getAuthHeader(token);

    if (headers.Authorization) {
        console.log(`[Scanner] Using provided token (cleaned)`);
    } else {
        console.log(`[Scanner] No token provided - limited rate limits apply.`);
    }

    if (target.repo) {
        try {
            console.log(`[Scanner] Requesting single repo: GET /repos/${target.owner}/${target.repo}`);
            const { data } = await octokit.request('GET /repos/{owner}/{repo}', {
                owner: target.owner,
                repo: target.repo,
                headers
            });
            console.log(`[Scanner] Found repo: ${data.full_name} (default branch: ${data.default_branch})`);
            return [{ name: data.name, owner: data.owner.login, default_branch: data.default_branch }];
        } catch (e: any) {
            console.error("[Scanner] Error fetching repo:", e);
            throw new Error(`Repository ${target.owner}/${target.repo} not found. (${e.message})`);
        }
    } else {
        try {
            console.log(`[Scanner] Requesting user repos: GET /users/${target.owner}/repos`);
            const { data } = await octokit.request('GET /users/{username}/repos', {
                username: target.owner,
                per_page: 100,
                sort: 'updated',
                headers
            });
            console.log(`[Scanner] Found ${data.length} public repos for user ${target.owner}`);
            return data.map(r => ({ name: r.name, owner: r.owner.login, default_branch: r.default_branch || 'main' }));
        } catch (e: any) {
            console.error("[Scanner] Error fetching user repos:", e);
            throw new Error(`User ${target.owner} not found or no public repos. (${e.message})`);
        }
    }
}

export async function downloadRepoZip(owner: string, repo: string, branch: string, token?: string): Promise<ArrayBuffer> {
    console.log(`[Scanner] Downloading zip for ${owner}/${repo} (ref: ${branch})...`);

    // Use local proxy to avoid CORS issues with GitHub redirects
    const params = new URLSearchParams({
        owner,
        repo,
        ref: branch
    });

    const headers: Record<string, string> = {};
    const auth = getAuthHeader(token);
    if (auth.Authorization) {
        headers['Authorization'] = auth.Authorization;
    }

    try {
        const response = await fetch(`/api/github/zip?${params.toString()}`, {
            headers
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || `Failed to fetch: ${response.status} ${response.statusText}`);
        }

        const buffer = await response.arrayBuffer();
        console.log(`[Scanner] Download complete. Size: ${buffer.byteLength} bytes.`);
        return buffer;
    } catch (e: any) {
        console.error("Error downloading zip", e);
        throw e; // Re-throw as is
    }
}

export interface ExtractedFile {
    path: string;
    content: string;
}

export async function extractFilesFromZip(zipData: ArrayBuffer): Promise<ExtractedFile[]> {
    const zip = new JSZip();
    const loadedZip = await zip.loadAsync(zipData);
    const files: ExtractedFile[] = [];

    for (const [relativePath, fileEntry] of Object.entries(loadedZip.files)) {
        if (!fileEntry.dir) {
            // Skip binary files
            if (relativePath.match(/\.(png|jpg|jpeg|gif|ico|pdf|zip|tar|gz|exe|dll|woff|woff2|ttf|eot)$/i)) {
                continue;
            }

            const content = await fileEntry.async("string");
            files.push({
                path: relativePath,
                content
            });
        }
    }
    return files;
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
                        line: index + 1
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
