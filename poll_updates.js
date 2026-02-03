const https = require('https');

// Configuration
const GITHUB_PAT = process.env.GITHUB_PAT;
const OWNER = 'Painsel'; // Update this or use env var
const REPO = 'Everythingtt';
const PATH = 'badges'; // Folder to monitor

if (!GITHUB_PAT) {
    console.error('Error: GITHUB_PAT environment variable is not set.');
    process.exit(1);
}

let lastCommitSha = '';

function pollGithub() {
    const options = {
        hostname: 'api.github.com',
        path: `/repos/${OWNER}/${REPO}/commits?path=${PATH}&per_page=1`,
        method: 'GET',
        headers: {
            'User-Agent': 'NodeJS-Polling-Script',
            'Authorization': `token ${GITHUB_PAT}`,
            'Accept': 'application/vnd.github.v3+json'
        }
    };

    const req = https.request(options, (res) => {
        let data = '';

        res.on('data', (chunk) => {
            data += chunk;
        });

        res.on('end', () => {
            if (res.statusCode === 200) {
                const commits = JSON.parse(data);
                if (commits.length > 0) {
                    const currentSha = commits[0].sha;
                    if (currentSha !== lastCommitSha) {
                        if (lastCommitSha !== '') {
                            console.log(`[${new Date().toISOString()}] New update detected! New SHA: ${currentSha}`);
                            // Trigger your update logic here
                        } else {
                            console.log(`[${new Date().toISOString()}] Initial SHA: ${currentSha}. Monitoring for changes...`);
                        }
                        lastCommitSha = currentSha;
                    }
                }
            } else {
                console.error(`Error: Received status code ${res.statusCode}`);
                console.error(data);
            }
        });
    });

    req.on('error', (e) => {
        console.error(`Problem with request: ${e.message}`);
    });

    req.end();
}


console.log(`Starting polling for ${OWNER}/${REPO}/${PATH}...`);
setInterval(pollGithub, 30000);
pollGithub();
