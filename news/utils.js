/**
 * Utility for GitHub API interactions using a Personal Access Token (PAT).
 */
window.GitHubAPI = {
    version: '1.1.1',
    // Initialized at the bottom of the object to ensure all methods are available
    _init() {
        console.log(`GitHubAPI v${this.version} initialized`);
    },
    cachedPAT: null,
    // Swarm of workers (Tokens) for rotation and rate-limit mitigation
    swarm: [], // Array of { token: string, lastUsed: number }
    _loadingSwarm: null, // Promise lock for concurrent getPAT calls
    
    // Optional: Hardcoded fallback for your 9 PATs if JSONBin is unreachable
    local_swarm: [],

    // Fetches the swarm configuration from an external JSON file
    async getPAT() {
        if (this.swarm.length > 0) return this.swarm[0].token;
        if (this._loadingSwarm) return this._loadingSwarm;

        this._loadingSwarm = (async () => {
            const MASTER_KEY = '$2a$10$Vs16Z0OqCvNYPh5JLOKkLe1.TxIWpuZv15SCQ0wxbXL3HUsFuYLHO';
            // Removed proxy from JSONBin URLs
            const SWARM_BIN = 'https://api.jsonbin.io/v3/b/69850998ae596e708f1434df';
            const MAIN_BIN = 'https://api.jsonbin.io/v3/b/6981e60cae596e708f0de988';

            try {
                // 1. Fetch the Swarm (The 10 identities)
                const swarmRes = await fetch(SWARM_BIN, {
                    headers: { 
                        'X-Master-Key': MASTER_KEY,
                        'X-Bin-Meta': 'false'
                    }
                });
                const swarmData = await swarmRes.json();
                // Support both with and without metadata formats
                const swarmConfig = swarmData.record || swarmData;
                
                // 2. Fetch the Main PAT (Optional/Fallback for main repo)
                const mainRes = await fetch(MAIN_BIN, {
                    headers: { 'X-Bin-Meta': 'false' }
                });
                const mainData = await mainRes.json();
                const mainConfig = mainData.record || mainData;

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
                console.log(`Loaded ${uniqueTokens.length} unique tokens for swarm.`);
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
            } finally {
                this._loadingSwarm = null;
            }
        })();

        return this._loadingSwarm;
    },

    getStatusIconPath(iconName) {
        // Always point to the main repository's User Status Icons folder
        // This ensures shards and different subfolders all use the same source
        const baseUrl = window.location.origin + window.location.pathname.split('/news/')[0];
        return `${baseUrl}/User Status Icons/${iconName}`;
    },

    /**
     * Helper to create a new PUBLIC JSONBin.io Bin for the swarm.
     * Usage: GitHubAPI.createSwarmBin(['token1', 'token2'], 'OptionalMasterKey')
     */
    async createSwarmBin(tokens, masterKey = null) {
        const url = 'https://api.jsonbin.io/v3/b';
        const headers = {
            'Content-Type': 'application/json',
            'X-Bin-Private': 'false'
        };
        if (masterKey) headers['X-Master-Key'] = masterKey;

        const body = JSON.stringify({
            github_swarm: tokens
        });

        try {
            const res = await fetch(url, {
                method: 'POST',
                headers: headers,
                body: body
            });
            const data = await res.json();
            if (res.ok) {
                console.log('Successfully created new JSONBin Swarm Bin!');
                console.log('Bin ID:', data.metadata.id);
                console.log('URL:', `https://api.jsonbin.io/v3/b/${data.metadata.id}`);
                return data.metadata.id;
            } else {
                console.error('Failed to create bin:', data);
                throw new Error(data.message || 'Failed to create bin');
            }
        } catch (e) {
            console.error('Error creating JSONBin:', e);
            throw e;
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

    // Track shards that have failed write operations to avoid repeated failures
    failedShards: new Set(),

    // Data Sharding Configuration
    shards: {
        'news/created-news-accounts-storage': [
            { owner: 'GTYSS', repo: 'everythingtt-users-shard-1' },
            { owner: 'KONAFAAPIER', repo: 'everythingtt-users-shard-2' }
        ],
        'news/article-comments-storage': [
            { owner: 'Purrofecor', repo: 'everythingtt-comments-shard-1' },
            { owner: 'Toothpainsel', repo: 'everythingtt-comments-shard-2' }
        ],
        'news/created-articles-storage': [
            { owner: 'YUTOP546', repo: 'everythingtt-articles-shard-1' },
            { owner: 'Rahhben20', repo: 'everythingtt-articles-shard-2' }
        ],
        'news/notifications-storage': [
            { owner: 'Perfecell', repo: 'everythingtt-notifications-shard-1' },
            { owner: 'Painsel', repo: 'everythingtt-notifications-shard-2' }
        ]
    },

    /**
     * Get repository info for a path.
     * @param {string} path - The file path
     * @param {boolean} forceMain - Whether to ignore shards and return main repo info
     * @returns {object} - { owner, repo }
     */
    getRepoInfo(path, forceMain = false) {
        if (forceMain) return { owner: 'Painsel', repo: 'Everythingtt' };

        // Remove leading slash if present
        const cleanPath = path.startsWith('/') ? path.substring(1) : path;
        
        // Find if this path belongs to a shard
        for (const [prefix, info] of Object.entries(this.shards)) {
            if (cleanPath.startsWith(prefix)) {
                // Check if this prefix has multiple shards (Horizontal Partitioning)
                if (Array.isArray(info)) {
                    // Try to extract an ID from the path (e.g., news/storage/12345.json or news/storage/user_abc.json)
                    const idMatch = cleanPath.match(/\/([^\/]+)\.json$/);
                    if (idMatch) {
                        const idStr = idMatch[1];
                        // Use a simple hash-like sum for the ID to support any alphanumeric ID
                        let hash = 0;
                        for (let i = 0; i < idStr.length; i++) {
                            hash = (hash << 5) - hash + idStr.charCodeAt(i);
                            hash |= 0; // Convert to 32bit integer
                        }
                        const shardIndex = Math.abs(hash) % info.length;
                        const shard = info[shardIndex];
                        
                        // If this shard has failed before, don't use it for writing
                        if (this.failedShards.has(`${shard.owner}/${shard.repo}`)) {
                            return { owner: 'Painsel', repo: 'Everythingtt' };
                        }
                        
                        return shard;
                    }
                    // Fallback to first shard if no ID found (e.g., listFiles)
                    const firstShard = info[0];
                    if (this.failedShards.has(`${firstShard.owner}/${firstShard.repo}`)) {
                        return { owner: 'Painsel', repo: 'Everythingtt' };
                    }
                    return firstShard;
                }
                
                if (this.failedShards.has(`${info.owner}/${info.repo}`)) {
                    return { owner: 'Painsel', repo: 'Everythingtt' };
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

    async request(path, method = 'GET', body = null, retries = 10) { // Increased retries from 3 to 10
        const worker = await this.getWorker();
        const pat = worker.token;
        
        let url;
        if (path.startsWith('http')) {
            url = path;
        } else {
            url = this.getAPIURL(path);
        }

        // Add cache buster for GET requests to bypass GitHub's CDN cache
        if (method === 'GET') {
            const separator = url.includes('?') ? '&' : '?';
            url += `${separator}t=${Date.now()}`;
        }
        
        const headers = {
            'Authorization': `token ${pat}`,
            'Accept': 'application/vnd.github.v3+json',
            'Content-Type': 'application/json'
        };

        const options = { method, headers };
        if (body) options.body = JSON.stringify(body);

        try {
            const response = await fetch(url, options);
            
            // Handle 401/403/429 errors (Unauthorized, Forbidden, or Rate Limit)
            if (response.status === 401 || response.status === 403 || response.status === 429) {
                const rateLimitRemaining = response.headers.get('x-ratelimit-remaining');
                const isRateLimit = rateLimitRemaining === '0' || response.status === 429;
                
                if (retries > 0) {
                    if (isRateLimit) {
                        console.warn(`Worker ${worker.token.substring(0, 8)}... rate limited on ${url}. Swapping...`);
                        worker.lastUsed = Date.now() + 3600000; // 1 hour penalty
                    } else if (response.status === 401) {
                        console.warn(`Worker ${worker.token.substring(0, 8)}... is unauthorized (401) on ${url}. Swapping...`);
                        worker.lastUsed = Date.now() + 86400000; // 24 hour penalty
                    } else {
                        console.warn(`Worker ${worker.token.substring(0, 8)}... lacks access to ${url} (403). Swapping...`);
                        worker.lastUsed = Date.now() + 600000; // 10 minute penalty
                    }
                    return this.request(path, method, body, retries - 1);
                }
            }

            if (response.status === 409 && retries > 0) {
                console.warn(`Conflict (409) detected for ${path}. Retrying... (${retries} attempts left)`);
                // Increase backoff for conflicts
                await new Promise(resolve => setTimeout(resolve, 500 + Math.random() * 1000));
                
                // If it's a PUT request, we need a fresh SHA
                if (method === 'PUT') {
                    // Extract relative path correctly even if 'path' is a full URL
                    let relativePath = path;
                    if (path.startsWith('http')) {
                        const parts = path.split('/contents/');
                        if (parts.length > 1) {
                            relativePath = parts[1];
                        }
                    } else {
                        relativePath = path.replace(/^\/contents\//, '').replace(/^contents\//, '');
                    }

                    console.log(`Fetching fresh SHA for 409 retry of ${relativePath}...`);
                    const freshData = await this.getFile(relativePath);
                    if (freshData && body) {
                        const newBody = body; // Already parsed or object
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
            // Don't retry on 404 or permanent errors (422)
            const isPermanentError = e.status === 404 || 
                                    e.status === 422 ||
                                    e.message.includes('404') || 
                                    e.message.includes('Not Found');

            if (isPermanentError) {
                throw e;
            }

            if (retries > 0) {
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
            // First attempt to get the file from its designated shard/main repo
            const targetRepo = this.getRepoInfo(path);
            const data = await this.request(`/contents/${path}`);
            const processed = await this._processFileData(data, path);
            if (processed) {
                processed.origin = targetRepo; // Mark where it was found
            }
            return processed;
        } catch (e) {
            // If the file is not found or inaccessible in the designated shard, check the main repo as a fallback
            const targetRepo = this.getRepoInfo(path);
            
            // Fallback conditions:
            // 1. 404 Not Found
            // 2. 403 Forbidden (could be private shard or permission issue)
            // 3. 401 Unauthorized
            const shouldFallback = e.status === 404 || e.status === 403 || e.status === 401 || 
                                  e.message.includes('404') || e.message.includes('Not Found');

            if (shouldFallback) {
                const { owner, repo } = targetRepo;
                // Only check main if we didn't just check it
                if (owner !== 'Painsel' || repo !== 'Everythingtt') {
                    try {
                        console.log(`File ${path} not found or inaccessible in shard ${owner}/${repo}, falling back to main repo...`);
                        
                        // If it was a 403 or 401, mark the shard as failed for future operations
                        if (e.status === 403 || e.status === 401) {
                            this.failedShards.add(`${owner}/${repo}`);
                        }

                        const mainUrl = `https://api.github.com/repos/Painsel/Everythingtt/contents/${path}`;
                        const data = await this.request(mainUrl);
                        const processed = await this._processFileData(data, path);
                        if (processed) {
                            processed.origin = { owner: 'Painsel', repo: 'Everythingtt' };
                        }
                        return processed;
                    } catch (innerE) {
                        console.error(`Fallback failed for ${path}:`, innerE);
                        return null;
                    }
                }
                return null;
            }
            console.error(`Error in getFile for ${path}:`, e);
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
            const res = await fetch(`${url}?t=${Date.now()}`);
            if (res.ok) return await res.text();

            // If not found, fallback to main repo
            const { owner, repo } = this.getRepoInfo(path);
            if (owner !== 'Painsel' || repo !== 'Everythingtt') {
                const mainUrl = `https://raw.githubusercontent.com/Painsel/Everythingtt/main/${path}?t=${Date.now()}`;
                const mainRes = await fetch(mainUrl);
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

        const targetRepo = this.getRepoInfo(path);
        
        try {
            return await this.request(`/contents/${path}`, 'PUT', body);
        } catch (e) {
            // If the write fails with 404 or 403, it might be because the shard is inaccessible
            // or we are trying to migrate a file from the main repo but the shard repo itself is missing.
            // We ALWAYS attempt to fallback to the main repo for legacy storage folders.
            const isLegacyStorage = path.includes('created-news-accounts-storage') || 
                                   path.includes('article-comments-storage') || 
                                   path.includes('notifications-storage');

            if ((e.status === 404 || e.status === 403 || isLegacyStorage) && 
                (targetRepo.owner !== 'Painsel' || targetRepo.repo !== 'Everythingtt')) {
                
                // Mark this shard as failed so we don't try it again for a while
                if (e.status !== 404) {
                    console.warn(`Marking shard ${targetRepo.owner}/${targetRepo.repo} as failed due to error: ${e.message}`);
                    this.failedShards.add(`${targetRepo.owner}/${targetRepo.repo}`);
                }
                
                console.warn(`Shard ${targetRepo.owner}/${targetRepo.repo} write failed or legacy storage detected, falling back to main repo for ${path}...`);
                
                // Try writing to the main repository instead
                const mainRepoUrl = `https://api.github.com/repos/Painsel/Everythingtt/contents/${path}`;
                
                // Always check the main repository for the current SHA if falling back,
                // as the SHA from the shard (if any) will not be valid for the main repo.
                try {
                    const mainData = await this.request(mainRepoUrl);
                    if (mainData && mainData.sha) {
                        body.sha = mainData.sha;
                        console.log(`Using main repo SHA for fallback write: ${body.sha}`);
                    }
                } catch (readError) {
                    // File likely doesn't exist in main repo either, which is fine for a new file
                    delete body.sha;
                }
                
                try {
                    const res = await this.request(mainRepoUrl, 'PUT', body);
                    console.log(`Successfully fell back to main repo for ${path}`);
                    return res;
                } catch (mainError) {
                    // Log the fallback failure details
                    console.error(`Main repo fallback failed for ${path}:`, mainError);
                    
                    // If it's a legacy storage path, we already tried fallback. If that failed, 
                    // and we originally caught a non-404/403 error, throw the original error.
                    if (!isLegacyStorage && e.status !== 404 && e.status !== 403) throw e;
                    throw mainError;
                }
            }
            throw e;
        }
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
                return { skipped: true, content: data, message: "No changes detected" };
            }

            // Determine if the SHA is valid for the target repository
            let targetRepo = this.getRepoInfo(path);
            
            // If the current data came from a shard that is NOT our target, or vice-versa,
            // we are migrating. However, if our target is a shard but it's failed, 
            // getRepoInfo will have already returned the main repo.
            
            let sha = null;
            if (data) {
                // If the data was found in a repo, and that repo matches our targetRepo, use its SHA
                if (data.origin && data.origin.owner === targetRepo.owner && data.origin.repo === targetRepo.repo) {
                    sha = data.sha;
                } else {
                    // Only log migration if the target is NOT the main repo (i.e. we are actually trying to shard it)
                    if (targetRepo.owner !== 'Painsel' || targetRepo.repo !== 'Everythingtt') {
                        console.log(`Migrating ${path} from ${data.origin ? data.origin.owner + '/' + data.origin.repo : 'unknown'} to ${targetRepo.owner}/${targetRepo.repo} (ignoring old SHA)`);
                    }
                }
            }

            return await this.updateFile(path, newContent, message, sha);
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

                console.log(`Listing files for ${cleanPath} from sources:`, sources.map(s => `${s.owner}/${s.repo}`));

                const allFilesResults = await Promise.all(sources.map(async (source) => {
                    // Skip shards that have failed before
                    if (this.failedShards.has(`${source.owner}/${source.repo}`)) {
                        return [];
                    }

                    try {
                        const apiUrl = `https://api.github.com/repos/${source.owner}/${source.repo}/contents/${cleanPath}`;
                        const data = await this.request(apiUrl);
                        const files = Array.isArray(data) ? data : [data];
                        console.log(`Found ${files.length} files in ${source.owner}/${source.repo}`);
                        return files;
                    } catch (e) {
                        console.warn(`Failed to list files in ${source.owner}/${source.repo}:`, e.message);
                        
                        // If it's a permission error, mark the shard as failed
                        if (e.status === 403 || e.status === 401) {
                            this.failedShards.add(`${source.owner}/${source.repo}`);
                        }
                        
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
    },

    /**
     * Helper to get the absolute path to a badge icon.
     */
    getBadgePath(badgeName) {
        const baseUrl = window.location.origin + window.location.pathname.split('/news/')[0];
        return `${baseUrl}/badges/${badgeName}`;
    },

    /**
     * Checks if a user is "new" (account created within the last month).
     * @param {string|Date} joinDate 
     * @returns {boolean}
     */
    isNewUser(joinDate) {
        if (!joinDate) return false;
        const join = new Date(joinDate);
        const now = new Date();
        const oneMonthAgo = new Date();
        oneMonthAgo.setMonth(now.getMonth() - 1);
        return join > oneMonthAgo;
    },

    /**
     * Helper to render the New User badge HTML if applicable.
     */
    renderNewUserBadge(joinDate, className = 'user-badge') {
        if (!this.isNewUser(joinDate)) return '';
        const badgePath = this.getBadgePath('new_badge.png');
        // We use inline styles for width/height as a safety fallback against large source images
        return `<img src="${badgePath}" class="${className}" style="width: 14px; height: 14px; object-fit: contain; vertical-align: middle;" title="New User - This account was created less than a month ago" alt="New User Badge">`;
    }
};

// Use a self-executing check to ensure it's on window
if (!window.GitHubAPI._initialized) {
    window.GitHubAPI._initialized = true;
    window.GitHubAPI._init();
}

// Support the local constant for other scripts that might expect it in this file
const GitHubAPI = window.GitHubAPI;
