# GitHub Secret Scanner

A client-side tool to scan GitHub repositories for sensitive data using RegEx patterns.

## Features

- **GitHub API Integration**: Scans public repositories or user profiles.
- **Client-Side Scanning**: No server required; runs entirely in your browser.
- **Custom Rules**: Create and manage your own RegEx patterns for secrets.
- **Real-time Statistics**: Track files scanned, data processed, and repositories checked.
- **Stop Functionality**: Cancel long-running scans at any time.

## Getting Started

### Development

First, install dependencies:

```bash
npm install
```

Then, run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to use the app.

### Building for Production

To create a production build:

```bash
npm run build
```

This generates an optimized version of the application in the `.next` folder.

## Usage

1.  **Configure Rules & Auth**: 
    *   Go to the **Admin** tab.
    *   **Optional**: Enter a **GitHub Personal Access Token** to increase rate limits (5,000 req/hr) and scan private repos.
    *   Enable/disable default patterns or add custom rules.
2.  **Enter Target**: On the **Scanner** tab, enter a GitHub username (e.g., `facebook`) or a specific repository URL (e.g., `facebook/react`).
3.  **Start Scan**: Click **Scan Now**.
    *   *Note: Large repositories may take time to fetch and scan.*
    *   *Check the browser console (F12) for detailed progress logs if it seems stuck.*
4.  **Review Results**:
    *   **Stop Button**: Use the **Stop** button if the scan is taking too long.
    *   **Statistics**: View real-time stats on files and bytes processed.
    *   **Matches**: Any found secrets will be listed with the file path and line number.

## Generating a GitHub Personal Access Token

To scan private repositories or increase API rate limits, you need a token. You can use either a **Classic** or **Fine-grained** token.

### Option A: Classic Token (Easiest)
1.  Go to **[Settings > Developer settings > Personal access tokens > Tokens (classic)](https://github.com/settings/tokens)**.
2.  Click **Generate new token (classic)**.
3.  **Scopes**:
    *   **Private Repositories**: Check the `repo` box (Full control of private repositories).
    *   **Public Repositories**: No scopes selected (just creating the token is enough).
4.  Copy the token (starts with `ghp_`).

### Option B: Fine-grained Token (More Secure)
1.  Go to **[Settings > Developer settings > Personal access tokens > Fine-grained tokens](https://github.com/settings/personal-access-tokens/new)**.
2.  **Resource owner**: Select your user (or organization).
3.  **Repository access**: Select **"Only select repositories"** and choose the specific repo (e.g., `my-app-portfolio`), or "All repositories".
4.  **Permissions**:
    *   Click **Repository permissions**.
    *   Find **Contents** and change it to **Read-only**.
5.  Generate and copy the token (starts with `github_pat_`).

## Troubleshooting

-   **API Rate Limits**: Unauthenticated requests are limited to 60/hr. **Solution**: Go to the Admin page and add a Personal Access Token to increase this to 5,000/hr.
-   **"Repository not found" Error**:
    *   Ensure the repository exists and the URL is correct.
    *   If the repository is **Private**, you **MUST** provide a valid Personal Access Token with the `repo` scope.
    *   If using **Fine-grained tokens**, ensure you have explicitly selected the repository you are trying to scan.
-   **"Scanning targets..." Hang**: Ensure the repository is public and not empty. Check the browser console (F12) for `[useScanner]` error logs.
-   **Workspace Warning**: You may see a workspace root warning in the console; this is harmless and due to local file structure.

## Tech Stack

-   **Framework**: Next.js 14 (App Router)
-   **Language**: TypeScript
-   **Styling**: Tailwind CSS
-   **Icons**: Lucide React
-   **API**: Octokit
