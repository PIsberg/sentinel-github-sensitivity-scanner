# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm install       # Install dependencies
npm run dev       # Start dev server at http://localhost:3000
npm run build     # Production build
npm run lint      # Run ESLint
npm run test:unit # Run Vitest unit tests (pure logic in src/lib)
npm test          # Run Playwright e2e tests (requires a browser + dev server)
```

Two test layers: **Vitest** unit tests live next to the code as `src/**/*.test.ts` and
cover the pure logic (scanner regex/diff parsing, provider URL/auth building, input
detection). **Playwright** e2e specs live in `e2e/` and drive the UI against mocked APIs.

## Architecture

**Next.js 14 App Router** app with two pages: `/` (Scanner tab) and `/admin` (Admin tab).

### Data flow for a scan

1. User enters a URL or shorthand (`owner/repo`, `owner`) in `Scanner.tsx`
2. `useScanner` hook (`hooks/useScanner.ts`) orchestrates the scan:
   - Calls `detectProvider` (`src/lib/providers/index.ts`) to parse the input into a `ParsedTarget` and determine which Git provider to use
   - Calls `getProvider(target)` to instantiate the correct `GitProvider` implementation
   - Calls `fetchRepositories` from `src/lib/scanner.ts` via the provider to list repos
   - Calls `downloadRepoZip` which hits the local proxy at `/api/archive/proxy` (Next.js route in `src/app/api/archive/proxy/route.ts`) — this proxy exists to handle redirect-based zip downloads that browsers can't follow cross-origin
   - Calls `extractFilesFromZip` (JSZip) to unpack, skipping binary extensions
   - Calls `scanContent` for each file — runs each enabled `Rule`'s RegExp line-by-line and collects `ScanResult` objects. Patterns go through `buildRegex` (supports PCRE-style `(?i)` inline flags); matches are dropped if the matched text is a known placeholder (`PLACEHOLDER_RE` in `scanner.ts`: `EXAMPLE`, `YOUR_API_KEY`, `xxxx`, …)
3. Results stream into state as matches are found; `abortRef` flag enables mid-scan cancellation

### Provider abstraction (`src/lib/providers/`)

Each Git host is a class implementing the `GitProvider` interface (`types.ts`):

- `GitHubProvider` — `github.com`, uses `https://api.github.com`
- `GitLabProvider` — `gitlab.com` or self-hosted `.gitlab.com` subdomains
- `BitbucketProvider` — `bitbucket.org`
- `GiteaProvider` — any other host (self-hosted); requires `baseUrl`

`detectProvider(url, giteaBaseUrl?)` in `index.ts` parses raw input into a `ParsedTarget` (bare `owner` or `owner/repo` shorthands default to GitHub). `getProvider(target)` instantiates the right class.

### State management

- **`RulesContext`** (`src/contexts/RulesContext.tsx`): persists scan rules to `localStorage` key `scanner_rules`. Seeded with the exported `DEFAULT_RULES` set (36 rules spanning cloud/AI/VCS/payment/registry/DB secrets) on first load. `DEFAULT_RULES` is exported so a unit test (`RulesContext.test.ts`) can assert every shipped pattern compiles.
- **`ConfigContext`** (`src/contexts/ConfigContext.tsx`): persists per-provider PATs under `localStorage` key `scanner_tokens` (a `ProviderTokens` object). Migrates from the legacy single-token key `scanner_config_token` on first load. Also stores `giteaBaseUrl` under `scanner_gitea_base_url`. Tokens are cleaned of `Bearer `/`token ` prefixes by `cleanToken` in `src/lib/providers/utils.ts`.
- Both contexts are provided at the root layout level.

### Key types (`src/types/index.ts`)

- `Rule` — `{ id, name, pattern (RegExp string), severity, description }`
- `ScanResult` — `{ repo, file, ruleId, match (line preview, truncated past 50 chars), line, + optional commit* fields for history scans }`
- `ParsedTarget` — `{ provider: GitProviderType, owner, repo?, baseUrl? }`
- `ProviderTokens` — `{ github, gitlab, bitbucket, gitea }` (all strings)

### API route

`GET /api/archive/proxy?url=<encoded-url>` — server-side proxy that forwards the `Authorization` header and follows redirects to stream the zipball back to the client. Required because provider zipball endpoints redirect and CORS blocks client-side redirect following.

The proxy is an SSRF-sensitive surface (it fetches a caller-supplied URL with the caller's token), so request handling lives in `src/lib/security/ssrf.ts` and applies, on the initial URL **and every redirect hop**:

- HTTPS only.
- Rejects internal hostnames (`localhost`, `*.local`, `*.internal`) and any host that resolves (via DNS) to a private / loopback / link-local / reserved IP range — covering DNS-rebinding and the cloud metadata endpoint (`169.254.169.254`). Decimal/octal/hex IPv4 literals are normalised by the URL parser and caught too.
- Bounds redirects (`maxRedirects`, default 5) and **drops the `Authorization` header on cross-origin redirects** so the token only reaches the originally targeted host.

`proxyFetch` and `validateProxyUrl` take injectable `fetchFn` / `lookupFn` parameters so the redirect/auth/IP logic is unit-tested in `src/lib/security/ssrf.test.ts` without network access.
