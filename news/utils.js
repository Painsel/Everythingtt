/**
 * Utility for GitHub API interactions using a Personal Access Token (PAT).
 */
const GitHubAPI = {
    cachedPAT: null,
    swarm: [], // Array of { token: string, lastUsed: number }

    // Fetches the swarm configuration from an external JSON file
    async getPAT() {
        if (this.swarm.length > 0) return this.swarm[0].token;
        
        try {
            const response = await fetch('https://api.jsonbin.io/v3/b/6981e60cae596e708f0de988', {
                headers: { 'X-Bin-Meta': 'false' }
            });
            const config = await response.json();
            
            // Handle both single token and array of tokens (swarm)
            if (Array.isArray(config.github_swarm)) {
                this.swarm = config.github_swarm.map(t => ({ token: t, lastUsed: 0 }));
            } else if (config.github_pat) {
                this.swarm = [{ token: config.github_pat, lastUsed: 0 }];
            }

            if (this.swarm.length > 0) {
                this.cachedPAT = this.swarm[0].token;
                localStorage.setItem('gh_pat', this.cachedPAT);
                return this.cachedPAT;
            }
            return localStorage.getItem('gh_pat');
        } catch (e) {
            console.error('Failed to load external swarm:', e);
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
        worker.lastUsed = Date.now();
        return worker;
    },

    // Data Sharding Configuration
    shards: {
        'news/created-news-accounts-storage': [
            { owner: 'Painsel', repo: 'everythingtt-users-alpha' },
            { owner: 'Painsel', repo: 'everythingtt-users-beta' },
            { owner: 'Painsel', repo: 'everythingtt-users-gamma' }
        ],
        'news/article-comments-storage': [
            { owner: 'Painsel', repo: 'everythingtt-comments-alpha' },
            { owner: 'Painsel', repo: 'everythingtt-comments-beta' }
        ],
        'news/created-articles-storage': { owner: 'Painsel', repo: 'everythingtt-articles-db' },
        'news/notifications-storage': { owner: 'Painsel', repo: 'everythingtt-notifications-db' }
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
                        const id = idMatch[1];
                        // Routing Algorithm: simpleId % totalShards
                        const simpleId = parseInt(id.toString().slice(-6));
                        const shardIndex = simpleId % info.length;
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

    async request(path, method = 'GET', body = null, retries = 3) {
        const worker = await this.getWorker();
        const pat = worker.token;
        
        const url = this.getAPIURL(path);
        
        const headers = {
            'Authorization': `token ${pat}`,
            'Accept': 'application/vnd.github.v3+json',
            'Content-Type': 'application/json'
        };

        const options = { method, headers };
        if (body) options.body = JSON.stringify(body);

        try {
            const response = await fetch(url, options);
            
            // Handle Rate Limiting (403 or 429) by switching workers immediately
            if ((response.status === 403 || response.status === 429) && retries > 0) {
                const rateLimitRemaining = response.headers.get('x-ratelimit-remaining');
                if (rateLimitRemaining === '0' || response.status === 429) {
                    console.warn(`Worker ${worker.token.substring(0, 8)}... rate limited. Swapping...`);
                    // Mark this worker as used far in the future to deprioritize it
                    worker.lastUsed = Date.now() + 3600000; // 1 hour penalty
                    return this.request(path, method, body, retries - 1);
                }
            }

            if (response.status === 409 && retries > 0) {
                console.warn(`Conflict (409) detected for ${path}. Retrying... (${retries} attempts left)`);
                // Wait for a random jittered interval before retrying
                await new Promise(resolve => setTimeout(resolve, 500 + Math.random() * 1000));
                
                // If it's a PUT request, we need a fresh SHA
                if (method === 'PUT') {
                    const freshData = await this.getFile(path.replace('/contents/', ''));
                    if (freshData && body) {
                        const newBody = JSON.parse(options.body);
                        newBody.sha = freshData.sha;
                        return this.request(path, method, newBody, retries - 1);
                    }
                }
                return this.request(path, method, body, retries - 1);
            }

            if (!response.ok) {
                let errorMessage = `GitHub API request failed with status ${response.status}`;
                try {
                    const errorData = await response.json();
                    errorMessage = errorData.message || errorMessage;
                } catch (e) {}
                
                if (response.status !== 404) {
                    console.error('GitHub API Error:', errorMessage);
                }
                throw new Error(errorMessage);
            }
            return response.json();
        } catch (e) {
            if (retries > 0 && !e.message.includes('404')) {
                await new Promise(resolve => setTimeout(resolve, 1000));
                return this.request(path, method, body, retries - 1);
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
            const data = await this.request(`/contents/${path}`);
            
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
            if (e.message.includes('Not Found') || e.message.includes('404')) return null;
            throw e;
        }
    },

    // High-speed raw fetch for read-only operations (no SHA returned)
    async getFileRaw(path) {
        try {
            const url = this.getRawURL(path);
            const res = await fetch(`${url}?t=${Date.now()}`);
            if (!res.ok) return null;
            const content = await res.text();
            return content;
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
            // Aggregate files from all shards
            try {
                const allFilesResults = await Promise.all(shards.map(async (shard) => {
                    try {
                        const url = `https://api.github.com/repos/${shard.owner}/${shard.repo}/contents/${cleanPath}`;
                        const worker = await this.getWorker();
                        const headers = {
                            'Authorization': `token ${worker.token}`,
                            'Accept': 'application/vnd.github.v3+json'
                        };
                        const res = await fetch(url, { headers });
                        if (!res.ok) return [];
                        const data = await res.json();
                        return Array.isArray(data) ? data : [data];
                    } catch (e) {
                        return [];
                    }
                }));
                return allFilesResults.flat();
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
