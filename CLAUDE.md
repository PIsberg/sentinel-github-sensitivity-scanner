# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm install       # Install dependencies
npm run dev       # Start dev server at http://localhost:3000
npm run build     # Production build
npm run lint      # Run ESLint
```

There are no automated tests in this project.

## Architecture

**Next.js 14 App Router** app with two pages: `/` (Scanner tab) and `/admin` (Admin tab).

### Data flow for a scan

1. User enters a GitHub username or `owner/repo` URL in `Scanner.tsx`
2. `useScanner` hook (in `hooks/useScanner.ts`) orchestrates the scan:
   - Calls `parseGitHubUrl` → `fetchRepositories` from `src/lib/scanner.ts` to resolve repos via Octokit
   - Calls `downloadRepoZip` which hits the local proxy at `/api/github/zip` (Next.js route in `src/app/api/github/zip/route.ts`) — this proxy exists solely to handle GitHub's redirect-based zip downloads that browsers can't follow cross-origin
   - Calls `extractFilesFromZip` (JSZip) to unpack, skipping binary extensions
   - Calls `scanContent` for each file — runs each enabled `Rule`'s RegExp line-by-line and collects `ScanResult` objects
3. Results stream into state as matches are found; `abortRef` flag enables mid-scan cancellation

### State management

- **`RulesContext`** (`src/contexts/RulesContext.tsx`): persists scan rules to `localStorage` key `scanner_rules`. Seeded with 4 default rules (AWS key, private key, generic password, Google API key) on first load.
- **`ConfigContext`** (`src/contexts/ConfigContext.tsx`): persists the GitHub PAT to `localStorage` key `scanner_config_token`. Token is cleaned of `Bearer `/`token ` prefixes before use.
- Both contexts are provided at the root layout level.

### Key types (`src/types/index.ts`)

- `Rule` — `{ id, name, pattern (RegExp string), severity, description }`
- `ScanResult` — `{ repo, file, ruleId, match (truncated to 50 chars), line }`

### API route

`GET /api/github/zip?owner=&repo=&ref=` — server-side proxy that forwards the `Authorization` header and streams the zipball back to the client. Required because GitHub's zipball endpoint redirects and CORS blocks client-side redirect following.
