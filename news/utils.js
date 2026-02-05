/**
 * Utility for GitHub API interactions using a Personal Access Token (PAT).
 */
const GitHubAPI = {
    cachedPAT: null,
    // Swarm of workers (Tokens) for rotation and rate-limit mitigation
    swarm: [], // Array of { token: string, lastUsed: number }
    
    // Optional: Hardcoded fallback for your 9 PATs if JSONBin is unreachable
      local_swarm: [
          // "github_pat_...",
          // Add your 9 PATs here locally. GitHub will block them if you try to push them.
      ],

    // Fetches the swarm configuration from an external JSON file
    async getPAT() {
        if (this.swarm.length > 0) return this.swarm[0].token;

        const MASTER_KEY = '$2a$10$Vs16Z0OqCvNYPh5JLOKkLe1.TxIWpuZv15SCQ0wxbXL3HUsFuYLHO';
        const SWARM_BIN = 'https://corsproxy.io/?' + encodeURIComponent('https://api.jsonbin.io/v3/b/6984fc19d0ea881f40a3b259');
        const MAIN_BIN = 'https://corsproxy.io/?' + encodeURIComponent('https://api.jsonbin.io/v3/b/6981e60cae596e708f0de988');

        try {
            // 1. Fetch the Swarm (The 9 identities)
            const swarmRes = await fetch(SWARM_BIN, {
                headers: { 
                    'X-Master-Key': MASTER_KEY,
                    'X-Bin-Meta': 'false'
                }
            });
            const swarmConfig = await swarmRes.json();
            
            // 2. Fetch the Main PAT (Optional/Fallback for main repo)
            const mainRes = await fetch(MAIN_BIN, {
                headers: { 'X-Bin-Meta': 'false' }
            });
            const mainConfig = await mainRes.json();

            let tokens = [];
            
            // Merge tokens from both sources
            if (Array.isArray(swarmConfig.github_swarm)) {
                tokens = tokens.concat(swarmConfig.github_swarm);
            }
            if (mainConfig.github_pat) {
                tokens.push(mainConfig.github_pat);
            } else if (Array.isArray(mainConfig.github_swarm)) {
                tokens = tokens.concat(mainConfig.github_swarm);
            }

            // Remove duplicates and initialize swarm
            const uniqueTokens = [...new Set(tokens)];
            this.swarm = uniqueTokens.map(t => ({ token: t, lastUsed: 0 }));

            if (this.swarm.length > 0) {
                this.cachedPAT = this.swarm[0].token;
                localStorage.setItem('gh_pat', this.cachedPAT);
                return this.cachedPAT;
            }
            return localStorage.getItem('gh_pat');
        } catch (e) {
            console.error('Failed to load external swarm:', e);
            
            // Try local_swarm fallback
            if (this.local_swarm && this.local_swarm.length > 0) {
                console.log(`Using ${this.local_swarm.length} local workers from fallback...`);
                this.swarm = this.local_swarm.map(t => ({ token: t, lastUsed: 0 }));
                return this.swarm[0].token;
            }

            const local = localStorage.getItem('gh_pat');
            if (local) this.swarm = [{ token: local, lastUsed: 0 }];
            return local;
        }
    },

    // Get the next worker using rotation (longest idle)
    async getWorker() {
        if (this.swarm.length === 0) await this.getPAT();
        if (this.swarm.length === 0) throw new Error('No GitHub tokens available.');
        
        // Sort by lastUsed ascending to find the most idle worker
        this.swarm.sort((a, b) => a.lastUsed - b.lastUsed);
        const worker = this.swarm[0];
        
        // Update lastUsed to NOW + a small offset to prevent immediate reuse 
        // by another concurrent request before this one even starts.
        worker.lastUsed = Date.now() + 50; 
        return worker;
    },

    // Data Sharding Configuration
    shards: {
        'news/created-news-accounts-storage': [
            { owner: 'GTYSS', repo: 'everythingtt-users-shard-1' },
            { owner: 'KONAFAAPIER', repo: 'everythingtt-users-shard-2' }
        ],
        'news/article-comments-storage': [
            { owner: 'Purrofecor', repo: 'everythingtt-comments-shard-3' },
            { owner: 'Toothpainsel', repo: 'everythingtt-comments-shard-4' }
        ],
        'news/created-articles-storage': [
            { owner: 'YUTOP546', repo: 'everythingtt-users-shard-5' },
            { owner: 'Rahhben20', repo: 'everythingtt-comments-shard-1' }
        ],
        'news/notifications-storage': [
            { owner: 'Perfecell', repo: 'everythingtt-comments-shard-2' },
            { owner: 'CommentsShard3', repo: 'everythingtt-comments-shard-3' },
            { owner: 'COURTESYCOIL', repo: 'everythingtt-shard-9' }
        ]
    },

    getRepoInfo(path) {
        // Remove leading slash if present
        const cleanPath = path.startsWith('/') ? path.substring(1) : path;
        
        // Find if this path belongs to a shard
        for (const [prefix, info] of Object.entries(this.shards)) {
            if (cleanPath.startsWith(prefix)) {
                // Check if this prefix has multiple shards (Horizontal Partitioning)
                if (Array.isArray(info)) {
                    // Try to extract an ID from the path (e.g., news/storage/12345.json)
                    const idMatch = cleanPath.match(/\/(\d+)\.json$/);
                    if (idMatch) {
                        const idStr = idMatch[1];
                        // Use a simple hash-like sum for the ID to support any length
                        let hash = 0;
                        for (let i = 0; i < idStr.length; i++) {
                            hash = (hash << 5) - hash + idStr.charCodeAt(i);
                            hash |= 0; // Convert to 32bit integer
                        }
                        const shardIndex = Math.abs(hash) % info.length;
                        return info[shardIndex];
                    }
                    // Fallback to first shard if no ID found (e.g., listFiles)
                    return info[0];
                }
                return info;
            }
        }
        
        // Default to main repo
        return { owner: 'Painsel', repo: 'Everythingtt' };
    },

    getAPIURL(path) {
        const { owner, repo } = this.getRepoInfo(path.replace('/contents/', ''));
        return `https://api.github.com/repos/${owner}/${repo}${path}`;
    },

    getRawURL(path) {
        const { owner, repo } = this.getRepoInfo(path);
        return `https://raw.githubusercontent.com/${owner}/${repo}/main/${path}`;
    },

    getProxyURL(url) {
        return `https://corsproxy.io/?${encodeURIComponent(url)}`;
    },

    async fetchWithProxy(url, options = {}, useProxy = false) {
        let targetUrl = useProxy ? this.getProxyURL(url) : url;
        try {
            const res = await fetch(targetUrl, options);
            if (!res.ok && !useProxy && res.status !== 404) {
                return this.fetchWithProxy(url, options, true);
            }
            return res;
        } catch (e) {
            if (!useProxy) {
                return this.fetchWithProxy(url, options, true);
            }
            throw e;
        }
    },

    async request(path, method = 'GET', body = null, retries = 10, useProxy = false) { // Increased retries from 3 to 10
        const worker = await this.getWorker();
        const pat = worker.token;
        
        let url = this.getAPIURL(path);
        
        const headers = {
            'Authorization': `token ${pat}`,
            'Accept': 'application/vnd.github.v3+json',
            'Content-Type': 'application/json'
        };

        const options = { method, headers };
        if (body) options.body = JSON.stringify(body);

        try {
            const response = await this.fetchWithProxy(url, options, useProxy);
            
            // Handle Rate Limiting (403 or 429) by switching workers immediately
            if ((response.status === 403 || response.status === 429) && retries > 0) {
                const rateLimitRemaining = response.headers.get('x-ratelimit-remaining');
                if (rateLimitRemaining === '0' || response.status === 429) {
                    console.warn(`Worker ${worker.token.substring(0, 8)}... rate limited. Swapping...`);
                    // Mark this worker as used far in the future to deprioritize it
                    worker.lastUsed = Date.now() + 3600000; // 1 hour penalty
                    return this.request(path, method, body, retries - 1, useProxy);
                }
            }

            if (response.status === 409 && retries > 0) {
                console.warn(`Conflict (409) detected for ${path}. Retrying... (${retries} attempts left)`);
                // Use a smaller jitter for faster retries in a sharded environment
                await new Promise(resolve => setTimeout(resolve, 200 + Math.random() * 500));
                
                // If it's a PUT request, we need a fresh SHA
                if (method === 'PUT') {
                    const freshData = await this.getFile(path.replace('/contents/', ''));
                    if (freshData && body) {
                        const newBody = JSON.parse(options.body);
                        newBody.sha = freshData.sha;
                        return this.request(path, method, newBody, retries - 1, useProxy);
                    }
                }
                return this.request(path, method, body, retries - 1, useProxy);
            }

            if (!response.ok) {
                let errorMessage = `GitHub API request failed with status ${response.status}`;
                try {
                    const errorData = await response.json();
                    errorMessage = errorData.message || errorMessage;
                } catch (e) {}
                
                // Add status to error message to help with catch logic
                const error = new Error(errorMessage);
                error.status = response.status;
                
                if (response.status !== 404) {
                    console.error('GitHub API Error:', errorMessage);
                }
                throw error;
            }
            return response.json();
        } catch (e) {
            // Don't retry on 404
            if (e.status === 404 || e.message.includes('404') || e.message.includes('Not Found')) {
                throw e;
            }

            if (retries > 0) {
                await new Promise(resolve => setTimeout(resolve, 1000));
                return this.request(path, method, body, retries - 1, useProxy);
            }
            throw e;
        }
    },

    // A simple queue to serialize write operations per-file
    writeQueues: {},
    async queuedWrite(path, operation) {
        if (!this.writeQueues[path]) {
            this.writeQueues[path] = Promise.resolve();
        }

        // Chain the new operation to the existing queue for this file
        const result = this.writeQueues[path].then(async () => {
            try {
                return await operation();
            } catch (e) {
                console.error(`Queued write failed for ${path}:`, e);
                throw e;
            }
        });

        this.writeQueues[path] = result.catch(() => {}); // Prevent queue from breaking on error
        return result;
    },

    async getFile(path) {
        try {
            // First attempt to get the file from its designated shard/main repo
            const data = await this.request(`/contents/${path}`);
            return await this._processFileData(data, path);
        } catch (e) {
            // If the file is not found in the designated shard, check the main repo as a fallback
            if (e.status === 404 || e.message.includes('404')) {
                const { owner, repo } = this.getRepoInfo(path);
                // Only check main if we didn't just check it
                if (owner !== 'Painsel' || repo !== 'Everythingtt') {
                    try {
                        const mainUrl = `https://api.github.com/repos/Painsel/Everythingtt/contents/${path}`;
                        const data = await this.request(mainUrl.replace('https://api.github.com/repos/Painsel/Everythingtt', ''));
                        return await this._processFileData(data, path);
                    } catch (innerE) {
                        return null;
                    }
                }
                return null;
            }
            throw e;
        }
    },

    async _processFileData(data, path) {
        try {
            let content;
            // If file is > 1MB, GitHub doesn't include 'content'. We must fetch from download_url.
            if (!data.content && data.download_url) {
                // Add timestamp to bypass cache for large files
                const rawRes = await fetch(`${data.download_url}?t=${Date.now()}`);
                content = await rawRes.text();
            } else if (data.content) {
                // GitHub base64 can contain newlines, remove them before decoding
                content = decodeURIComponent(escape(atob(data.content.replace(/\s/g, ''))));
            } else {
                return null;
            }

            // Safety check for empty or invalid content
            if (!content || content.trim() === "") {
                if (!path.endsWith('.gitkeep')) {
                    console.warn(`File at ${path} returned empty content.`);
                }
                return null;
            }

            return {
                content,
                sha: data.sha
            };
        } catch (e) {
            console.error(`Error processing file data for ${path}:`, e);
            return null;
        }
    },

    // High-speed raw fetch for read-only operations (no SHA returned)
    async getFileRaw(path) {
        try {
            // Check designated shard first
            const url = this.getRawURL(path);
            const res = await this.fetchWithProxy(`${url}?t=${Date.now()}`);
            if (res.ok) return await res.text();

            // If not found, fallback to main repo
            const { owner, repo } = this.getRepoInfo(path);
            if (owner !== 'Painsel' || repo !== 'Everythingtt') {
                const mainUrl = `https://raw.githubusercontent.com/Painsel/Everythingtt/main/${path}?t=${Date.now()}`;
                const mainRes = await this.fetchWithProxy(mainUrl);
                if (mainRes.ok) return await mainRes.text();
            }
            return null;
        } catch (e) {
            return null;
        }
    },

    async updateFile(path, content, message, sha = null) {
        const body = {
            message,
            content: btoa(unescape(encodeURIComponent(content)))
        };
        if (sha) body.sha = sha;
        return this.request(`/contents/${path}`, 'PUT', body);
    },

    /**
     * Atomic-like fetch-modify-write operation to prevent data loss.
     * @param {string} path - The file path
     * @param {function} transformFn - Function that takes current content (string) and returns new content (string)
     * @param {string} message - Commit message
     */
    async safeUpdateFile(path, transformFn, message) {
        return this.queuedWrite(path, async () => {
            const data = await this.getFile(path);
            const currentContent = data ? data.content : "";
            const newContent = await transformFn(currentContent);
            
            if (newContent === currentContent && data) {
                return { skipped: true, message: "No changes detected" };
            }

            return await this.updateFile(path, newContent, message, data ? data.sha : null);
        });
    },

    async listFiles(path) {
        // Remove leading slash if present
        const cleanPath = path.startsWith('/') ? path.substring(1) : path;
        
        // Find if this path belongs to a sharded prefix
        let shards = null;
        for (const [prefix, info] of Object.entries(this.shards)) {
            if (cleanPath.startsWith(prefix) && Array.isArray(info)) {
                shards = info;
                break;
            }
        }

        if (shards) {
            // Aggregate files from all shards PLUS the main repo
            try {
                // Add the main repo to the list of sources to check
                const sources = [
                    ...shards,
                    { owner: 'Painsel', repo: 'Everythingtt' }
                ];

                const allFilesResults = await Promise.all(sources.map(async (source) => {
                    try {
                        const url = `https://api.github.com/repos/${source.owner}/${source.repo}/contents/${cleanPath}`;
                        const worker = await this.getWorker();
                        const headers = {
                            'Authorization': `token ${worker.token}`,
                            'Accept': 'application/vnd.github.v3+json'
                        };
                        const res = await this.fetchWithProxy(url, { headers });
                        if (!res.ok) return [];
                        const data = await res.json();
                        return Array.isArray(data) ? data : [data];
                    } catch (e) {
                        return [];
                    }
                }));
                const flatFiles = allFilesResults.flat();
                
                // Deduplicate by path to prevent issues if shards overlap
                const seen = new Set();
                return flatFiles.filter(file => {
                    const isDuplicate = seen.has(file.path);
                    seen.add(file.path);
                    return !isDuplicate;
                });
            } catch (e) {
                console.error('Failed to list files across shards:', e);
                return [];
            }
        }

        try {
            const data = await this.request(`/contents/${path}`);
            return Array.isArray(data) ? data : [data];
        } catch (e) {
            // GitHub returns 404 if the folder doesn't exist yet
            if (e.message.includes('Not Found') || e.message.includes('404')) return [];
            throw e;
        }
    },

    // Alias for listFiles to prevent errors if renamed or cached
    async getDirectory(path) {
        return this.listFiles(path);
    },

    generateID() {
        return Math.floor(Math.random() * 900000000000000) + 100000000000000;
    }
};
