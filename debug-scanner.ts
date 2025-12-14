
import { fetchRepositories, getFileTree, parseGitHubUrl } from "./src/lib/scanner";

async function testScanner() {
    const targetUrl = "https://github.com/PIsberg/my-app-portfolio";
    console.log(`Testing scanner with URL: ${targetUrl}`);

    try {
        const target = parseGitHubUrl(targetUrl);
        if (!target) {
            console.error("Failed to parse URL");
            return;
        }
        console.log("Parsed Target:", target);

        console.log("1. Fetching Repositories...");
        const repos = await fetchRepositories(target);
        console.log(`Found ${repos.length} repositories.`);
        console.log(repos);

        if (repos.length > 0) {
            const repo = repos[0];
            console.log(`2. Fetching File Tree for ${repo.owner}/${repo.name} on branch ${repo.default_branch}...`);
            const tree = await getFileTree(repo.owner, repo.name, repo.default_branch);
            console.log(`Tree fetched. Contains ${tree.length} files.`);
            if (tree.length > 0) {
                console.log("First 5 files:", tree.slice(0, 5).map(t => t.path));
            } else {
                console.warn("Tree is empty!");
            }
        }
    } catch (e) {
        console.error("Test Failed with Error:", e);
    }
}

testScanner();
