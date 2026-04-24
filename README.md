# Git Sentinel — Multi-Provider Secret Scanner

[![CI](https://github.com/PIsberg/sentinel-github-sensitivity-scanner/actions/workflows/ci.yml/badge.svg)](https://github.com/PIsberg/sentinel-github-sensitivity-scanner/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

A browser-based tool that scans Git repositories for secrets and sensitive data using configurable RegEx rules. Supports GitHub, GitLab, Bitbucket, and self-hosted Gitea instances.

## Features

- **Multi-provider support** — GitHub, GitLab, Bitbucket, and any Gitea instance
- **Git history scanning** — optionally scan commit diffs in addition to the latest source
- **16 built-in rules** — AWS keys, private keys, OpenAI/Anthropic/Google API keys, GitHub/GitLab PATs, Stripe, Slack, SendGrid, npm tokens, and more
- **Custom rules** — add, edit, delete, import, and export your own RegEx patterns
- **Real-time progress** — live file/commit counter and progress bar
- **Stop at any time** — cancel a running scan mid-way
- **Client-side only** — no data leaves your browser except the API calls to the Git provider

## Getting Started

```bash
npm install      # install dependencies
npm run dev      # dev server at http://localhost:3000
npm run build    # production build
npm run lint     # ESLint
```

## Running tests

[Playwright](https://playwright.dev) E2E tests cover the Scanner page, Admin page, and navigation. All network calls are mocked so no credentials or internet access are required.

```bash
npm test              # run all 38 tests (headless Chromium)
npm run test:headed   # run with a visible browser window
npm run test:ui       # open the interactive Playwright UI
npm run test:report   # open the last HTML report
```

## Usage

### 1. Configure (Admin tab)

- Add **provider tokens** to raise API rate limits and scan private repositories.
- Enable/disable or add custom **scanning rules**.

### 2. Scan (Scanner tab)

Enter any of the following:

| Input format | Example | Behaviour |
|---|---|---|
| `owner/repo` | `torvalds/linux` | Scans that single repo (defaults to GitHub) |
| `owner` | `torvalds` | Scans all repos for that user (defaults to GitHub) |
| Full URL | `github.com/torvalds/linux` | Provider auto-detected |
| GitLab | `gitlab.com/user/repo` | Uses GitLab API |
| Bitbucket | `bitbucket.org/workspace/repo` | Uses Bitbucket API |
| Gitea | `https://gitea.example.com/user/repo` | Uses Gitea API |

Optionally check **Scan git history** to also scan commit diffs (set a max commit count to avoid rate limits).

### 3. Review results

Matches are listed with the repository name, file path, line number, and the matched text. When history scanning is enabled, the commit SHA, message, author, and date are also shown.

## Provider tokens

Tokens are stored in your browser's `localStorage` — they never leave your machine.

### GitHub
Go to **Settings › Developer settings › Personal access tokens**.
- Classic token (`ghp_`): grant `public_repo` scope (or `repo` for private).
- Fine-grained token (`github_pat_`): grant **Contents: Read-only** on the target repositories.

### GitLab
Create a **Personal Access Token** under **User Settings › Access Tokens** with `read_api` scope.

### Bitbucket
Create an **App Password** under **Settings › App passwords** with **Repositories: Read** permission. Enter credentials as `username:apppassword`.

### Gitea
Generate a token under **Settings › Applications** on your Gitea instance. Set the **Instance URL** in the Admin tab when using shorthand `owner/repo` input.

## Troubleshooting

| Symptom | Fix |
|---|---|
| 429 / rate-limit errors | Add a provider token in the Admin tab |
| "Repository not found" | Check the URL; add a token with repo access if the repo is private |
| Scan hangs at "Fetching repositories" | Open the browser console (F12) for `[useScanner]` error details |
| GitLab / Gitea self-hosted not detected | Enter the full URL including scheme (`https://`) |

## Tech stack

| | |
|---|---|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS v4 |
| Icons | Lucide React |
| ZIP extraction | JSZip |
| Testing | Playwright |
