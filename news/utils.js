/**
 * Utility for GitHub API interactions using a Personal Access Token (PAT).
 */
window.GitHubAPI = {
    version: '1.3.5',
    // Initialized at the bottom of the object to ensure all methods are available
    _init() {
        console.log(`GitHubAPI v${this.version} initialized (Main Repo Only)`);
    },
    cachedPAT: null,
    _loadingPAT: null, // Promise lock for concurrent getPAT calls
    middlewareURL: null, // Set this to use a Vercel middleware instead of direct GitHub API calls
    
    // Fetches the Main PAT or Middleware URL from JSONBin
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

    getStatusIconPath(iconName) {
        const baseUrl = window.location.origin + window.location.pathname.split('/news/')[0];
        return `${baseUrl}/User Status Icons/${iconName}`;
    },

    /**
     * Get repository info for a path.
     * Always returns the main Everythingtt repository.
     */
    getRepoInfo(path) {
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

    // Global request queue to serialize all API calls and avoid 409/429 errors
    _requestQueue: Promise.resolve(),
    async _enqueue(operation) {
        const result = this._requestQueue.then(async () => {
            try {
                return await operation();
            } catch (e) {
                throw e;
            }
        });
        // Update the queue to wait for this result, but don't let a failure block the next request
        this._requestQueue = result.catch(() => {});
        return result;
    },

    async request(path, method = 'GET', body = null, retries = 5) {
        // Enqueue the request to ensure serial execution
        return this._enqueue(async () => {
            const pat = await this.getPAT();
            
            let url;
            let headers = {
                'Accept': 'application/vnd.github.v3+json',
                'Content-Type': 'application/json'
            };

            // Middleware is now confirmed working at the root URL
            if (this.middlewareURL) {
                let base = this.middlewareURL;
                if (!base.endsWith('/')) base += '/';
                
                let apiPath;
                if (path.startsWith('http')) {
                    // Only allow requests to the main repository
                    const mainRepoPath = '/repos/Painsel/Everythingtt';
                    const urlObj = new URL(path);
                    apiPath = urlObj.pathname;
                    
                    if (!apiPath.startsWith(mainRepoPath)) {
                        console.error(`Middleware restricted: Attempted to access non-main repo: ${apiPath}`);
                        // Fallback to direct API for other repos if PAT exists, or throw
                        if (pat) {
                            url = path;
                            headers['Authorization'] = `token ${pat}`;
                            // Skip the middleware block
                            return this._proceedWithFetch(url, options, method, body, retries, path);
                        } else {
                            throw new Error('Middleware is restricted to the main repository and no token is available for other repositories.');
                        }
                    }
                } else {
                    // It's a relative path like /contents/...
                    apiPath = this.getAPIURL(path).replace('https://api.github.com', '');
                }

                url = `${base}?path=${encodeURIComponent(apiPath)}`;
            } else {
                // Fallback to direct GitHub API
                if (!pat) throw new Error('No GitHub token available.');
                
                if (path.startsWith('http')) {
                    url = path;
                } else {
                    url = this.getAPIURL(path);
                }
                headers['Authorization'] = `token ${pat}`;
            }

            // Add cache buster for GET requests
            if (method === 'GET') {
                const separator = url.includes('?') ? '&' : '?';
                url += `${separator}t=${Date.now()}`;
            }
            
            const options = { method, headers };
            if (body) options.body = JSON.stringify(body);

            return this._proceedWithFetch(url, options, method, body, retries, path);
        });
    },

    async _proceedWithFetch(url, options, method, body, retries, originalPath) {
        try {
            const response = await fetch(url, options);
            
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
            return response.json();
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
                const rawRes = await fetch(`${data.download_url}?t=${Date.now()}`);
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
            const url = this.getRawURL(path);
            const res = await fetch(`${url}?t=${Date.now()}`);
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

    async safeUpdateFile(path, transformFn, message) {
        return this.queuedWrite(path, async () => {
            const data = await this.getFile(path);
            const currentContent = data ? data.content : "";
            const newContent = await transformFn(currentContent);
            
            if (newContent === currentContent && data) {
                return { skipped: true, content: data, message: "No changes detected", finalContent: currentContent };
            }

            const res = await this.updateFile(path, newContent, message, data ? data.sha : null);
            // Attach the final content to the response so callers don't try to parse it from the metadata
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
