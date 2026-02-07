/**
 * Utility for GitHub API interactions using a Personal Access Token (PAT).
 */
window.GitHubAPI = {
    version: '1.5.8',
    // Initialized at the bottom of the object to ensure all methods are available
    _init() {
        console.log(`GitHubAPI v${this.version} initialized (High Performance Mode)`);
    },
    cachedPAT: null,
    _loadingPAT: null, // Promise lock for concurrent getPAT calls
    middlewareURL: null, // Set this to use a Vercel middleware instead of direct GitHub API calls
    _userSHA: null, // Store current user's SHA globally
    _fileCache: new Map(), // Client-side cache for GET requests
    CACHE_TTL: 10000, // 10 seconds client-side cache
    
    /**
     * Synchronize the current user's profile metadata from remote storage.
     * @param {Function} onUpdate Optional callback when data is updated
     */
    async syncUserProfile(onUpdate = null) {
        const localUserStr = localStorage.getItem('current_user');
        if (!localUserStr) return null;
        
        try {
            const localUser = JSON.parse(localUserStr);
            const data = await this.getFile(`news/created-news-accounts-storage/${localUser.id}.json`);
            
            if (data) {
                this._userSHA = data.sha;
                const remoteUser = JSON.parse(data.content);
                remoteUser.sha = data.sha; // Preserve SHA

                // Force Logout Check
                if (remoteUser.forceLogout === true) {
                    console.warn(`[GitHubAPI] Force logout signal detected for ${remoteUser.username}`);
                    localStorage.removeItem('current_user');
                    // Find the relative path to the news root
                    const newsRoot = window.location.pathname.includes('/news/') 
                        ? window.location.pathname.split('/news/')[0] + '/news/index.html'
                        : '/news/index.html';
                    window.location.href = newsRoot;
                    return null;
                }

                // Compare and update if changed
                if (JSON.stringify(remoteUser) !== JSON.stringify(localUser)) {
                    localStorage.setItem('current_user', JSON.stringify(remoteUser));
                    console.log(`[GitHubAPI] Profile metadata synced for ${remoteUser.username}`);
                    if (onUpdate) onUpdate(remoteUser);
                    return remoteUser;
                }
                return localUser;
            }
        } catch (e) {
            console.error('[GitHubAPI] Profile sync failed:', e);
        }
        return null;
    },
    async getPAT() {
        if (this.cachedPAT) return this.cachedPAT;
        if (this._loadingPAT) return this._loadingPAT;

        this._loadingPAT = (async () => {
            const MAIN_BIN = 'https://api.jsonbin.io/v3/b/6981e60cae596e708f0de988';
            try {
                const mainRes = await fetch(MAIN_BIN, {
                    headers: { 'X-Bin-Meta': 'false' }
                });
                const mainData = await mainRes.json();
                const mainConfig = mainData.record || mainData;

                if (mainConfig.middleware_url) {
                    this.middlewareURL = mainConfig.middleware_url;
                }

                if (mainConfig.github_pat) {
                    this.cachedPAT = mainConfig.github_pat;
                    localStorage.setItem('gh_pat', this.cachedPAT);
                    return this.cachedPAT;
                }
                
                const local = localStorage.getItem('gh_pat');
                if (local) {
                    this.cachedPAT = local;
                    return local;
                }
                return null;
            } catch (e) {
                const local = localStorage.getItem('gh_pat');
                if (local) {
                    this.cachedPAT = local;
                    return local;
                }
                return null;
            } finally {
                this._loadingPAT = null;
            }
        })();
        return this._loadingPAT;
    },

    async getClientIP() {
        try {
            const res = await fetch('https://api.ipify.org?format=json');
            const data = await res.json();
            return data.ip;
        } catch (e) {
            console.error('Failed to fetch IP:', e);
            return null;
        }
    },

    getStatusIconPath(iconName) {
        const baseUrl = window.location.origin + window.location.pathname.split('/news/')[0];
        return `${baseUrl}/User Status Icons/${iconName}`;
    },

    /**
     * Get repository info for a path.
     */
    getRepoInfo(path) {
        const storageFolders = [
            'article-comments-storage',
            'created-articles-storage',
            'created-news-accounts-storage',
            'notifications-storage'
        ];
        
        const isStorage = storageFolders.some(folder => path.includes(folder));
        
        if (isStorage) {
            return { owner: 'Painsel', repo: 'Everything-TT-Critical-Data' };
        }
        return { owner: 'Painsel', repo: 'Everythingtt' };
    },

    getAPIURL(path) {
        let cleanPath = path.replace('/contents/', '');
        const { owner, repo } = this.getRepoInfo(cleanPath);
        
        // If it's a storage path in the private repo, remove the 'news/' prefix
        // The storage folders themselves exist in the root of the private repo.
        if (repo === 'Everything-TT-Critical-Data') {
            cleanPath = cleanPath.replace(/^news\//, '');
        }
        
        return `https://api.github.com/repos/${owner}/${repo}/contents/${cleanPath}`;
    },

    getRawURL(path) {
        let cleanPath = path;
        const { owner, repo } = this.getRepoInfo(cleanPath);
        
        // If it's a storage path in the private repo, remove the 'news/' prefix
        // The storage folders themselves exist in the root of the private repo.
        if (repo === 'Everything-TT-Critical-Data') {
            cleanPath = cleanPath.replace(/^news\//, '');
        }
        
        return `https://raw.githubusercontent.com/${owner}/${repo}/main/${cleanPath}`;
    },

    // Global request queues to serialize API calls per host/service
    _queues: {},
    async _enqueue(operation, queueName = 'default') {
        if (!this._queues[queueName]) {
            this._queues[queueName] = Promise.resolve();
        }

        const result = this._queues[queueName].then(async () => {
            try {
                return await operation();
            } catch (e) {
                throw e;
            }
        });

        // Update the queue to wait for this result, but don't let a failure block the next request
        this._queues[queueName] = result.catch(() => {});
        return result;
    },

    /**
     * Get the current status of the request queues.
     */
    getQueueStatus() {
        const status = {};
        for (const [name, queue] of Object.entries(this._queues)) {
            status[name] = "active"; // Simplified as we can't easily peek promise state in JS
        }
        return status;
    },

    async request(path, method = 'GET', body = null, retries = 5) {
        // Client-side cache check
        if (method === 'GET') {
            const cached = this._fileCache.get(path);
            if (cached && (Date.now() - cached.timestamp < this.CACHE_TTL)) {
                return cached.data;
            }
        } else {
            // Clear cache for this path on any modification
            this._fileCache.delete(path);
        }

        const pat = await this.getPAT();
        let url;
        let headers = {
            'Accept': 'application/vnd.github.v3+json',
            'Content-Type': 'application/json'
        };

        const mainRepoPath = '/repos/Painsel/Everythingtt';
        const criticalRepoPath = '/repos/Painsel/Everything-TT-Critical-Data';
        
        let apiPath;
        if (path.startsWith('http')) {
            const urlObj = new URL(path);
            apiPath = urlObj.pathname;
        } else {
            apiPath = this.getAPIURL(path).replace('https://api.github.com', '');
        }

        let queueName = 'github';

        // Middleware logic
        if (this.middlewareURL) {
            let base = this.middlewareURL;
            if (!base.endsWith('/')) base += '/';
            
            // Check authorization for the middleware
            const isAuthorized = apiPath.startsWith(mainRepoPath) || apiPath.startsWith(criticalRepoPath);
            
            if (isAuthorized) {
                url = `${base}?path=${encodeURIComponent(apiPath)}`;
                queueName = 'middleware';
            } else {
                console.warn(`Middleware restricted: Attempted to access non-authorized path: ${apiPath}. Falling back to direct API.`);
                if (!pat) throw new Error('Middleware restricted and no GitHub token available for direct access.');
                
                url = path.startsWith('http') ? path : this.getAPIURL(path);
                headers['Authorization'] = `token ${pat}`;
            }
        } else {
            // Direct GitHub API
            if (!pat) throw new Error('No GitHub token available.');
            url = path.startsWith('http') ? path : this.getAPIURL(path);
            headers['Authorization'] = `token ${pat}`;
        }

        // Store direct API info for fallback
        const directInfo = {
            url: path.startsWith('http') ? path : this.getAPIURL(path),
            headers: { ...headers, 'Authorization': pat ? `token ${pat}` : headers['Authorization'] }
        };

        // Add cache buster for GET requests
        if (method === 'GET') {
            const separator = url.includes('?') ? '&' : '?';
            url += `${separator}t=${Date.now()}`;
            
            const directSep = directInfo.url.includes('?') ? '&' : '?';
            directInfo.url += `${directSep}t=${Date.now()}`;
        }
        
        const options = { method, headers };
        if (body) options.body = JSON.stringify(body);

        // Enqueue the request based on the target service
        return this._enqueue(async () => {
            try {
                return await this._proceedWithFetch(url, options, method, body, retries, path);
            } catch (e) {
                // Fallback to direct API if middleware fails (500/502/503/504, Network Error, or Specific Config Error)
                const isMiddlewareError = queueName === 'middleware' && (
                    e.status >= 500 || 
                    !e.status || 
                    e.message.includes('Server configuration error')
                );

                if (isMiddlewareError && pat) {
                    console.warn(`[GitHubAPI] Middleware unavailable or misconfigured: ${e.message}. Falling back to direct GitHub API.`);
                    const directOptions = { ...options, headers: directInfo.headers };
                    return this._proceedWithFetch(directInfo.url, directOptions, method, body, retries, path);
                }
                throw e;
            }
        }, queueName);
    },

    async _proceedWithFetch(url, options, method, body, retries, originalPath) {
        try {
            const response = await fetch(url, options);
            
            // Handle 409 Conflict (Git state mismatch)
            if (response.status === 409 && retries > 0) {
                await new Promise(resolve => setTimeout(resolve, 500 + Math.random() * 1000));
                
                if (method === 'PUT') {
                    let relativePath = originalPath;
                    if (originalPath.startsWith('http')) {
                        const parts = originalPath.split('/contents/');
                        if (parts.length > 1) relativePath = parts[1];
                    } else {
                        relativePath = originalPath.replace(/^\/contents\//, '').replace(/^contents\//, '');
                    }

                    const freshData = await this.getFile(relativePath);
                    if (freshData && body) {
                        body.sha = freshData.sha;
                        return this.request(originalPath, method, body, retries - 1);
                    }
                }
                return this.request(originalPath, method, body, retries - 1);
            }

            // Handle 504 Gateway Timeout (Common for Middleware/Vercel)
            if (response.status === 504 && retries > 0) {
                console.warn(`[GitHubAPI] Middleware timeout (504). Retrying... (${retries} left)`);
                await new Promise(resolve => setTimeout(resolve, 2000));
                return this.request(originalPath, method, body, retries - 1);
            }

            if (!response.ok) {
                let errorMessage = `API request failed with status ${response.status}`;
                try {
                    const errorData = await response.json();
                    errorMessage = errorData.message || errorMessage;
                } catch (e) {}
                
                const error = new Error(errorMessage);
                error.status = response.status;
                throw error;
            }

            const data = await response.json();
            
            // Cache successful GET requests
            if (method === 'GET') {
                this._fileCache.set(originalPath, {
                    data: data,
                    timestamp: Date.now()
                });
            }
            
            return data;
        } catch (e) {
            if (e.status === 404 || e.status === 422) throw e;

            if (retries > 0) {
                await new Promise(resolve => setTimeout(resolve, 1000));
                return this.request(originalPath, method, body, retries - 1);
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

        const result = this.writeQueues[path].then(async () => {
            try {
                return await operation();
            } catch (e) {
                throw e;
            }
        });

        this.writeQueues[path] = result.catch(() => {});
        return result;
    },

    async getFile(path) {
        try {
            const data = await this.request(`/contents/${path}`);
            return await this._processFileData(data, path);
        } catch (e) {
            if (e.status === 404) return null;
            throw e;
        }
    },

    async _processFileData(data, path) {
        try {
            let content;
            if (!data.content && data.download_url) {
                const sep = data.download_url.includes('?') ? '&' : '?';
                const rawRes = await fetch(`${data.download_url}${sep}t=${Date.now()}`);
                content = await rawRes.text();
            } else if (data.content) {
                content = decodeURIComponent(escape(atob(data.content.replace(/\s/g, ''))));
            } else {
                return null;
            }

            if (!content || content.trim() === "") return null;

            return {
                content,
                sha: data.sha
            };
        } catch (e) {
            return null;
        }
    },

    async getFileRaw(path) {
        try {
            const { repo } = this.getRepoInfo(path);
            
            // For private repo, use getFile() to ensure we go through the middleware with PAT
            if (repo === 'Everything-TT-Critical-Data') {
                const data = await this.getFile(path);
                return data ? data.content : null;
            }

            // For public repo, direct raw fetch is faster and bypasses middleware queuing
            const url = this.getRawURL(path);
            const sep = url.includes('?') ? '&' : '?';
            const res = await fetch(`${url}${sep}t=${Date.now()}`);
            if (res.ok) return await res.text();
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

        return await this.request(`/contents/${path}`, 'PUT', body);
    },

    async deleteFile(path, message, sha) {
        const body = {
            message,
            sha
        };
        return await this.request(`/contents/${path}`, 'DELETE', body);
    },

    async safeDeleteFile(path, message) {
        return this.queuedWrite(path, async () => {
            const data = await this.getFile(path);
            if (!data) return { skipped: true, message: "File not found" };
            return await this.deleteFile(path, message, data.sha);
        });
    },

    async safeUpdateFile(path, transform, message) {
        // Optimization: Atomic push via Middleware
        if (this.middlewareURL && (typeof transform === 'string' || (typeof transform === 'object' && transform !== null && !transform.then))) {
            try {
                const res = await this.request(`${path}?action=push`, 'POST', {
                    transform: transform,
                    message: message
                });
                
                if (res.skipped) return res;
                
                // Update local cache with new content
                this._fileCache.set(`/contents/${path}`, {
                    data: {
                        content: btoa(unescape(encodeURIComponent(res.finalContent))),
                        sha: res.content ? res.content.sha : (res.commit ? res.commit.sha : null)
                    },
                    timestamp: Date.now()
                });

                return res;
            } catch (e) {
                console.warn('[GitHubAPI] Atomic push failed, falling back to safe update:', e);
                // Fallback to standard safe update
            }
        }

        return this.queuedWrite(path, async () => {
            const data = await this.getFile(path);
            const currentContent = data ? data.content : "";
            
            let newContent;
            if (typeof transform === 'function') {
                newContent = await transform(currentContent);
            } else if (typeof transform === 'object') {
                // If it's an object and we are here (fallback or no middleware), 
                // we apply the same logic as the middleware would
                try {
                    const currentJSON = currentContent ? JSON.parse(currentContent) : {};
                    if (transform._action === 'append') {
                        const list = Array.isArray(currentJSON) ? currentJSON : [];
                        list.push(transform.data);
                        newContent = JSON.stringify(list, null, 2);
                    } else {
                        newContent = JSON.stringify({ ...currentJSON, ...transform }, null, 2);
                    }
                } catch (e) {
                    throw new Error('Invalid JSON for transform: ' + e.message);
                }
            } else {
                newContent = transform;
            }
            
            if (newContent === currentContent && data) {
                return { skipped: true, content: data, message: "No changes detected", finalContent: currentContent };
            }

            const res = await this.updateFile(path, newContent, message, data ? data.sha : null);
            return { ...res, finalContent: newContent };
        });
    },

    async listFiles(path) {
        try {
            const data = await this.request(`/contents/${path}`);
            return Array.isArray(data) ? data : [data];
        } catch (e) {
            if (e.status === 404) return [];
            throw e;
        }
    },

    async getDirectory(path) {
        return this.listFiles(path);
    },

    generateID() {
        return Math.floor(Math.random() * 900000000000000) + 100000000000000;
    },

    getBadgePath(badgeName) {
        const baseUrl = window.location.origin + window.location.pathname.split('/news/')[0];
        return `${baseUrl}/badges/${badgeName}`;
    },

    isNewUser(joinDate) {
        if (!joinDate) return false;
        const join = new Date(joinDate);
        const now = new Date();
        const oneMonthAgo = new Date();
        oneMonthAgo.setMonth(now.getMonth() - 1);
        return join > oneMonthAgo;
    },

    renderNewUserBadge(joinDate, className = 'user-badge') {
        if (!this.isNewUser(joinDate)) return '';
        const badgePath = this.getBadgePath('new_badge.png');
        return `<img src="${badgePath}" class="${className}" style="width: 40px; height: 40px; object-fit: contain; vertical-align: middle;" title="New User - This account was created less than a month ago" alt="New User Badge">`;
    }
};

// Use a self-executing check to ensure it's on window
if (!window.GitHubAPI._initialized) {
    window.GitHubAPI._initialized = true;
    window.GitHubAPI._init();
}

// Support the local constant for other scripts that might expect it in this file
const GitHubAPI = window.GitHubAPI;
