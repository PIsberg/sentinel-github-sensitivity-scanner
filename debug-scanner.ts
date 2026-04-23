
import { fetchRepositories } from "./src/lib/scanner";
import { detectProvider, getProvider } from "./src/lib/providers/index";

async function testScanner() {
    const targetUrl = "https://github.com/PIsberg/my-app-portfolio";
    console.log(`Testing scanner with URL: ${targetUrl}`);

    try {
        const target = detectProvider(targetUrl);
        if (!target) {
            console.error("Failed to parse URL");
            return;
        }
        console.log("Parsed Target:", target);

        const provider = getProvider(target);
        console.log("1. Fetching Repositories...");
        const repos = await fetchRepositories(target, provider);
        console.log(`Found ${repos.length} repositories.`);
        console.log(repos);
    } catch (e) {
        console.error("Test Failed with Error:", e);
    }
}

testScanner();
