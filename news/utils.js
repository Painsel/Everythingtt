/**
 * Utility for GitHub API interactions using a Personal Access Token (PAT).
 */
window.GitHubAPI = {
    version: '1.5.8',
    // Initialized at the bottom of the object to ensure all methods are available
    _init() {
        console.log(`GitHubAPI v${this.version} initialized (High Performance Mode)`);
        
        // [SECURITY] Clear any legacy PATs from localStorage
        localStorage.removeItem('gh_pat');
        
        // Pre-fetch configuration to get middleware URL without exposing PAT
        this._fetchConfig();
    },
    async _fetchConfig() {
        const MAIN_BIN = 'https://api.jsonbin.io/v3/b/6981e60cae596e708f0de988';
        try {
            const res = await fetch(MAIN_BIN, { headers: { 'X-Bin-Meta': 'false' } });
            const data = await res.json();
            const config = data.record || data;
            if (config.middleware_url) {
                this.middlewareURL = config.middleware_url;
            }
        } catch (e) {
            console.error('[GitHubAPI] Failed to fetch config:', e);
        }
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
        // [SECURITY] PAT is no longer stored or fetched client-side.
        // All authenticated requests must go through the secure middleware.
        return null;
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
            'notifications-storage',
            'banned-ips.json'
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
        // Separate path and query parameters
        let [basePath, queryStr] = path.split('?');

        // Client-side cache check
        if (method === 'GET') {
            const cached = this._fileCache.get(basePath);
            if (cached && (Date.now() - cached.timestamp < this.CACHE_TTL)) {
                return cached.data;
            }
        } else {
            // Clear cache for this path on any modification
            this._fileCache.delete(basePath);
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
        if (basePath.startsWith('http')) {
            const urlObj = new URL(basePath);
            apiPath = urlObj.pathname;
        } else {
            apiPath = this.getAPIURL(basePath).replace('https://api.github.com', '');
        }

        let queueName = 'github';

        // Middleware logic
        if (this.middlewareURL) {
            let base = this.middlewareURL;
            if (!base.endsWith('/')) base += '/';
            
            // [SECURITY] All storage/critical paths MUST go through the middleware.
            // The middleware now holds the PAT securely on the server-side.
            const isAuthorized = apiPath.startsWith(mainRepoPath) || apiPath.startsWith(criticalRepoPath);
            
            if (isAuthorized) {
                url = `${base}?path=${encodeURIComponent(apiPath)}`;
                if (queryStr) {
                    url += `&${queryStr}`;
                }
                queueName = 'middleware';
            } else {
                // Public repo paths can still be accessed directly as they don't require authentication
                url = basePath.startsWith('http') ? basePath : this.getAPIURL(basePath);
                if (queryStr) {
                    url += (url.includes('?') ? '&' : '?') + queryStr;
                }
            }
        } else {
            // [SECURITY] If middleware is not configured, critical operations should fail 
            // instead of attempting direct access with a non-existent token.
            const isCritical = apiPath.startsWith(criticalRepoPath);
            if (isCritical) {
                throw new Error('Secure connection unavailable. Critical operations are restricted.');
            }
            
            url = basePath.startsWith('http') ? basePath : this.getAPIURL(basePath);
            if (queryStr) {
                url += (url.includes('?') ? '&' : '?') + queryStr;
            }
        }

        // Store info for logging/fallback (direct access no longer uses PAT)
        const directInfo = {
            url: basePath.startsWith('http') ? basePath : this.getAPIURL(basePath),
            headers: { ...headers }
        };
        if (queryStr) {
            directInfo.url += (directInfo.url.includes('?') ? '&' : '?') + queryStr;
        }

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
                // [SECURITY] Fallback to direct API is only allowed for non-critical paths
                const isCritical = apiPath.startsWith(criticalRepoPath);
                
                const isMiddlewareError = queueName === 'middleware' && (
                    e.status >= 500 || 
                    !e.status || 
                    e.message.includes('Server configuration error')
                );

                if (isMiddlewareError && !isCritical) {
                    console.warn(`[GitHubAPI] Middleware unavailable: ${e.message}. Falling back to direct access.`);
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
                    // Strip query string for relative path extraction
                    const [pathOnly] = originalPath.split('?');
                    let relativePath = pathOnly;
                    
                    if (pathOnly.startsWith('http')) {
                        const parts = pathOnly.split('/contents/');
                        if (parts.length > 1) relativePath = parts[1];
                    } else {
                        relativePath = pathOnly.replace(/^\/contents\//, '').replace(/^contents\//, '');
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
                const [pathOnly] = originalPath.split('?');
                this._fileCache.set(pathOnly, {
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
        return this.renderBadge(badgePath, 'New User', 'This account was created less than a month ago.', className);
    },

    /**
     * Renders a badge with an enhanced tooltip that works on hover and tap.
     */
    renderBadge(iconPath, title, description, className = 'user-badge') {
        const uniqueId = 'badge-' + Math.random().toString(36).substr(2, 9);
        return `
            <div class="badge-wrapper" onclick="event.stopPropagation(); this.querySelector('.badge-tooltip').classList.toggle('active')">
                <img src="${iconPath}" class="${className}" alt="${title}">
                <div class="badge-tooltip">
                    <div class="tooltip-title">${title}</div>
                    <div class="tooltip-desc">${description}</div>
                </div>
            </div>
        `;
    },

    /**
     * Renders the special EverythingTT Theme badge.
     */
    renderThemeBadge(className = 'user-badge') {
        const badgePath = this.getBadgePath('big_fan.png'); // Using big_fan as the theme badge
        return this.renderBadge(badgePath, 'EverythingTT Elite', 'A distinguished member of the EverythingTT community.', className);
    },

    DEVELOPER_ID: '382156063438888', // The unique ID of the developer

    /**
     * Renders a role badge (e.g., Admin, BETA Tester) with enhanced tooltips.
     */
    renderRoleBadge(role, className = 'admin-badge') {
        if (role === 'admin') {
            return `
                <div class="badge-wrapper" onclick="event.stopPropagation(); this.querySelector('.badge-tooltip').classList.toggle('active')">
                    <span class="${className}">Admin</span>
                    <div class="badge-tooltip">
                        <div class="tooltip-title">Administrator</div>
                        <div class="tooltip-desc">Has full access to manage the EverythingTT ecosystem.</div>
                    </div>
                </div>
            `;
        }
        
        if (role === 'beta') {
            return `
                <div class="badge-wrapper" onclick="event.stopPropagation(); this.querySelector('.badge-tooltip').classList.toggle('active')">
                    <span class="beta-badge" style="background: #9c27b0; color: white; padding: 2px 6px; border-radius: 4px; font-size: 0.75rem; font-weight: bold;">BETA</span>
                    <div class="badge-tooltip">
                        <div class="tooltip-title">BETA Tester</div>
                        <div class="tooltip-desc">Tests upcoming features before they are officially released.</div>
                    </div>
                </div>
            `;
        }
        
        return '';
    }
};

// Use a self-executing check to ensure it's on window
if (!window.GitHubAPI._initialized) {
    window.GitHubAPI._initialized = true;
    window.GitHubAPI._init();
}

// Support the local constant for other scripts that might expect it in this file
const GitHubAPI = window.GitHubAPI;
