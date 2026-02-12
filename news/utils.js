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
        
        // Show pause modal globally on initialization
        this.showPauseModal('Initializing application resources...');
        
        // Pre-fetch configuration to get middleware URL without exposing PAT
        this._configPromise = this._fetchConfig();
        
        this._configPromise.then(() => {
            // After config is fetched, check if critical storage needs initialization
            this._initializeStorageIfNeeded();
        });
    },
    _configPromise: null,
    async _waitForConfig() {
        if (this._configPromise) {
            await this._configPromise;
        }
    },
    async _initializeStorageIfNeeded() {
        if (!this.middlewareURL) return;

        const criticalFolders = [
            'article-comments-storage',
            'created-articles-storage',
            'created-news-accounts-storage',
            'notifications-storage',
            'support-forms-storage',
            'mail-storage',
            'mail-accounts-storage',
            'mail-relay'
        ];

        try {
            console.log('[GitHubAPI] Checking critical storage structure...');
            
            // Check for banned-ips.json as a canary for the repo state
            const canary = await this.getFile('banned-ips.json');
            
            if (!canary) {
                console.warn('[GitHubAPI] Critical storage missing. Initializing new data structure...');
                
                // 1. Create banned-ips.json
                await this.updateFile('banned-ips.json', '[]', 'System: Initialize banned IPs storage');
                
                // 2. Create placeholder .gitkeep files for storage folders
                // GitHub doesn't support empty folders, so we create a hidden file in each.
                for (const folder of criticalFolders) {
                    await this.updateFile(`${folder}/.gitkeep`, '', `System: Initialize ${folder}`);
                }
                
                console.log('[GitHubAPI] Storage initialization complete.');
            } else {
                console.log('[GitHubAPI] Critical storage verified.');
            }
        } catch (e) {
            console.error('[GitHubAPI] Storage check/init failed:', e);
        }
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
            
            if (config.github_pat) {
                this.cachedPAT = config.github_pat;
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
     * Shows a "Pause" modal during long-running fetch operations
     * @param {string} subtitle Optional subtitle to show (e.g. "Fetching profile...")
     */
    showPauseModal(subtitle = 'Fetching data...') {
        let modal = document.getElementById('pause-modal');
        if (!modal) {
            const html = `
                <div id="pause-modal" class="pause-modal">
                    <div class="pause-content">
                        <span class="pause-icon">⏸️</span>
                        <h2 class="pause-title">PAUSED</h2>
                        <p id="pause-subtitle" class="pause-subtitle">${subtitle}</p>
                    </div>
                    <div class="pause-spinner"></div>
                </div>
            `;
            document.body.insertAdjacentHTML('beforeend', html);
            modal = document.getElementById('pause-modal');
        } else {
            document.getElementById('pause-subtitle').innerText = subtitle;
        }
        modal.classList.add('active');
    },

    /**
     * Hides the "Pause" modal
     */
    hidePauseModal() {
        const modal = document.getElementById('pause-modal');
        if (modal) {
            modal.classList.remove('active');
        }
    },
    
    _flaggedWords: null,
    async getFlaggedWords() {
        if (this._flaggedWords) return this._flaggedWords;
        try {
            // Find relative path to root rules folder
            const pathParts = window.location.pathname.split('/');
            const newsIndex = pathParts.indexOf('news');
            const rulesIndex = pathParts.indexOf('rules');
            let root = '';
            
            if (newsIndex !== -1) {
                root = '../'.repeat(pathParts.length - newsIndex - 1);
            } else if (rulesIndex !== -1) {
                root = '../'.repeat(pathParts.length - rulesIndex - 1);
            } else {
                root = './';
            }
            
            const res = await fetch(`${root}news/rules/flagged-words.json`);
            this._flaggedWords = await res.json();
            return this._flaggedWords;
        } catch (e) {
            console.error('Failed to load flagged words:', e);
            return [];
        }
    },

    async checkContentForRules(text) {
        if (!text) return { isClean: true, violatedWords: [] };
        const words = await this.getFlaggedWords();
        const lowerText = text.toLowerCase();
        const violatedWords = [];
        
        // Use regex to find whole words to avoid false positives (e.g., "analysis" containing "anal")
        for (const word of words) {
            if (!word) continue;
            const escapedWord = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const regex = new RegExp(`\\b${escapedWord}\\b`, 'i');
            if (regex.test(lowerText)) {
                violatedWords.push(word);
            }
        }
        
        return {
            isClean: violatedWords.length === 0,
            violatedWords: [...new Set(violatedWords)] // Remove duplicates
        };
    },

    /**
     * Shows a styled warning modal when content violates rules
     * @param {string[]} violatedWords - List of words that triggered the violation
     * @param {string} rootPath - Relative path to the news/ folder root (e.g. '../' or './')
     */
    showRulesWarningModal(violatedWords, rootPath = './') {
        // Remove existing modal if any
        const existing = document.getElementById('rules-warning-modal');
        if (existing) existing.remove();

        const modalHtml = `
            <div id="rules-warning-modal" class="rules-warning-modal">
                <div class="rules-warning-content">
                    <div class="rules-warning-header">
                        <span class="warning-icon">⚠️</span>
                        <h2>Rule Violation Detected</h2>
                    </div>
                    <div class="rules-warning-body">
                        <p>Your content contains language that violates our community standards. Please remove the following flagged terms before submitting:</p>
                        <div class="violated-words-container">
                            <span class="violated-words-label">Flagged Terms Found:</span>
                            <div class="violated-words-list">
                                ${violatedWords.map(word => `<span class="violated-word-tag">${word}</span>`).join('')}
                            </div>
                        </div>
                        <p style="font-size: 0.9rem; color: #b5bac1;">Repeated violations may lead to account restrictions or IP bans.</p>
                    </div>
                    <div class="rules-warning-footer">
                        <button class="rules-warning-btn btn-secondary-warning" onclick="document.getElementById('rules-warning-modal').classList.remove('active')">Go Back & Edit</button>
                        <a href="${rootPath}rules/index.html" class="rules-warning-btn btn-primary-warning">View Rules</a>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHtml);
        
        // Trigger reflow for animation
        const modal = document.getElementById('rules-warning-modal');
        setTimeout(() => modal.classList.add('active'), 10);
        
        // Handle click outside to close
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.classList.remove('active');
            }
        });
    },

    async isRuleBreaker(user) {
        if (!user) return false;
        // Check if explicitly flagged
        if (user.ruleBreaker === true) return true;
        
        // Check current profile content
        const contentToCheck = [
            user.username,
            user.bio || '',
            user.statusMsg || ''
        ];

        for (const content of contentToCheck) {
            const result = await this.checkContentForRules(content);
            if (!result.isClean) {
                // Track violation count if possible
                try {
                    if (user && !user.isGuest) {
                        user.violations = (user.violations || 0) + 1;
                        localStorage.setItem('current_user', JSON.stringify(user));
                        
                        // Async update on server
                        this.getFile(`created-news-accounts-storage/${user.id}.json`).then(data => {
                            if (data) {
                                const serverUser = JSON.parse(data.content);
                                serverUser.violations = (serverUser.violations || 0) + 1;
                                
                                // Automatic Ban if violations reach threshold (e.g., 10)
                                if (serverUser.violations >= 10 && !serverUser.isBanned) {
                                    serverUser.isBanned = true;
                                    serverUser.banReason = 'System: Repeated rule violations (Threshold reached)';
                                    serverUser.forceLogout = true;
                                }

                                this.updateFile(
                                    `created-news-accounts-storage/${user.id}.json`,
                                    JSON.stringify(serverUser),
                                    serverUser.isBanned ? `Security: AUTO-BAN - Repeated violations for ${user.username}` : `Security: Rule violation detected for ${user.username} (Total: ${serverUser.violations})`,
                                    data.sha
                                );
                            }
                        }).catch(e => console.error('[GitHubAPI] Failed to update server violations:', e));
                    }
                } catch (e) { console.error('[GitHubAPI] Failed to track violation:', e); }

                return true;
            }
        }

        return false;
    },
    
    /**
     * Synchronize the current user's profile metadata from remote storage.
     * @param {Function} onUpdate Optional callback when data is updated
     */
    async syncUserProfile(onUpdate = null) {
        const localUserStr = localStorage.getItem('current_user');
        if (!localUserStr) return null;
        
        try {
            const localUser = JSON.parse(localUserStr);
            if (localUser.isGuest) return localUser; // Don't sync guest profile
            
            const data = await this.getFile(`created-news-accounts-storage/${localUser.id}.json`);
            
            if (data) {
                this._userSHA = data.sha;
                const remoteUser = JSON.parse(data.content);
                remoteUser.sha = data.sha; // Preserve SHA

                // Force Logout Check
                const ADMIN_ID = '845829137251567';
                const isAdmin = String(remoteUser.id) === ADMIN_ID;

                if (remoteUser.forceLogout === true && !isAdmin) {
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
        // Return the PAT for the main repo (fetched from jsonbin)
        return this.cachedPAT;
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

    /**
     * Upload an audio blob to Supabase Storage.
     * @param {Blob} blob The audio blob to upload.
     * @returns {Promise<string>} The public URL of the uploaded audio.
     */
    async uploadAudio(blob) {
        await this._waitForConfig();
        
        if (!this._supabaseConfig) {
            const MAIN_BIN = 'https://api.jsonbin.io/v3/b/6981e60cae596e708f0de988';
            try {
                const res = await fetch(MAIN_BIN, { headers: { 'X-Bin-Meta': 'false' } });
                const data = await res.json();
                const config = data.record || data;
                this._supabaseConfig = {
                    url: 'https://fdodsmjxbxknnqfnzdtr.supabase.co',
                    key: config.supabase_anon_key || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZkb2RzbWp4Ynhrbm5xZm56ZHRyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA5MTU3MzgsImV4cCI6MjA4NjQ5MTczOH0.ATFjEwr8X07AcYMy0WjuANlCnFHLN05uZkIMyXaJasI'
                };
            } catch (e) {
                console.error('[GitHubAPI] Failed to fetch Supabase config:', e);
                throw new Error('Supabase configuration failed');
            }
        }

        const fileName = `voice_${Date.now()}.webm`;
        const bucket = 'AudiosAndNotifs';
        const folder = 'Voice Messages';
        const filePath = `${folder}/${fileName}`;

        // Use the standard object upload URL
        // Endpoint: https://fdodsmjxbxknnqfnzdtr.supabase.co/storage/v1/object/AudiosAndNotifs/Voice%20Messages/voice_123.webm
        const uploadUrl = `${this._supabaseConfig.url}/storage/v1/object/${bucket}/${filePath}`;

        const res = await fetch(uploadUrl, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this._supabaseConfig.key}`,
                'apikey': this._supabaseConfig.key,
                'x-upsert': 'true',
                'Content-Type': blob.type || 'audio/webm'
            },
            body: blob // Using raw body for standard REST upload instead of FormData for better S3/Supabase compatibility
        });

        if (!res.ok) {
            const errorData = await res.json().catch(() => ({}));
            console.error('[Supabase Upload Error]', errorData);
            
            // Provide a more helpful error message for the common RLS policy issue
            if (res.status === 400 || res.status === 403 || res.status === 401) {
                throw new Error('Unauthorized: Please ensure your Supabase Storage RLS policies allow "INSERT" for anonymous users on the "AudiosAndNotifs" bucket.');
            }
            throw new Error(errorData.error || errorData.message || `Upload failed (${res.status})`);
        }

        // Return the public URL
        return `${this._supabaseConfig.url}/storage/v1/object/public/${bucket}/${filePath}`;
    },

    /**
     * Delete an audio file from Supabase Storage.
     * @param {string} audioUrl The full public URL of the audio file.
     */
    async deleteAudio(audioUrl) {
        if (!audioUrl) return;
        await this._waitForConfig();

        if (!this._supabaseConfig) return; // Should already be loaded if upload worked

        try {
            // Extract the path from the URL
            // Format: https://project.supabase.co/storage/v1/object/public/bucket/folder/file.webm
            const urlObj = new URL(audioUrl);
            const pathParts = urlObj.pathname.split('/storage/v1/object/public/')[1];
            if (!pathParts) return;

            const bucket = pathParts.split('/')[0];
            const filePath = pathParts.substring(bucket.length + 1);

            const deleteUrl = `${this._supabaseConfig.url}/storage/v1/object/${bucket}/${filePath}`;

            const res = await fetch(deleteUrl, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${this._supabaseConfig.key}`,
                    'apikey': this._supabaseConfig.key
                }
            });

            if (!res.ok) {
                const errorData = await res.json().catch(() => ({}));
                console.warn('[Supabase Delete Warning]', errorData);
            }
        } catch (e) {
            console.error('[GitHubAPI] Failed to delete audio from Supabase:', e);
        }
    },
    _supabaseConfig: null,

    /**
     * Compare two IP addresses to see if they are in the same subnet.
     * This handles dynamic IP changes (common in home networks).
     */
    compareIPs(ip1, ip2) {
        if (!ip1 || !ip2) return false;
        if (ip1 === ip2) return true;

        // IPv4 Subnet Check (first 3 octets /24)
        const v4_1 = ip1.split('.');
        const v4_2 = ip2.split('.');
        if (v4_1.length === 4 && v4_2.length === 4) {
            return v4_1[0] === v4_2[0] && v4_1[1] === v4_2[1] && v4_1[2] === v4_2[2];
        }

        // IPv6 Subnet Check (first 4 segments /64)
        const v6_1 = ip1.split(':');
        const v6_2 = ip2.split(':');
        if (v6_1.length >= 4 && v6_2.length >= 4) {
            return v6_1[0] === v6_2[0] && v6_1[1] === v6_2[1] && v6_1[2] === v6_2[2] && v6_1[3] === v6_2[3];
        }

        return false;
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
            'support-forms-storage',
            'mail-storage',
            'mail-accounts-storage',
            'banned-ips.json'
        ];
        
        const isStorage = storageFolders.some(folder => path.includes(folder));
        
        if (isStorage) {
            return { owner: 'Painsel', repo: 'EverythingTT-Critical-Data' };
        }
        return { owner: 'Painsel', repo: 'Everythingtt' };
    },

    getAPIURL(path) {
        let cleanPath = path.replace('/contents/', '');
        const { owner, repo } = this.getRepoInfo(cleanPath);
        
        // If it's a storage path in the private repo, remove the 'news/' prefix
        // The storage folders themselves exist in the root of the private repo.
        if (repo === 'EverythingTT-Critical-Data') {
            cleanPath = cleanPath.replace(/^news\//, '');
        }
        
        return `https://api.github.com/repos/${owner}/${repo}/contents/${cleanPath}`;
    },

    getRawURL(path) {
        let cleanPath = path;
        const { owner, repo } = this.getRepoInfo(cleanPath);
        
        // If it's a storage path in the private repo, remove the 'news/' prefix
        // The storage folders themselves exist in the root of the private repo.
        if (repo === 'EverythingTT-Critical-Data') {
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
        // Ensure configuration (middleware URL, PAT) is loaded before proceeding
        await this._waitForConfig();

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
        const criticalRepoPath = '/repos/Painsel/EverythingTT-Critical-Data';
        
        let apiPath;
        if (basePath.startsWith('http')) {
            const urlObj = new URL(basePath);
            apiPath = urlObj.pathname;
        } else {
            apiPath = this.getAPIURL(basePath).replace('https://api.github.com', '');
        }

        const isCritical = apiPath.startsWith(criticalRepoPath);
        const isMain = apiPath.startsWith(mainRepoPath);

        // [SECURITY] Add PAT only for the main repo. 
        // Critical repo PAT is managed by the middleware.
        if (pat && isMain) {
            headers['Authorization'] = `token ${pat}`;
        }

        let queueName = 'github';

        // Middleware logic
        if (this.middlewareURL && isCritical) {
            let base = this.middlewareURL;
            if (!base.endsWith('/')) base += '/';
            
            // [SECURITY] Critical paths MUST go through the middleware.
            url = `${base}?path=${encodeURIComponent(apiPath)}`;
            if (queryStr) {
                url += `&${queryStr}`;
            }
            queueName = 'middleware';
        } else {
            // Non-critical paths (Main repo) or if middleware is not configured for non-critical paths
            if (isCritical && !this.middlewareURL) {
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

    /**
     * Internal helper to decode fetched data.
     * Uses a prefix-based detection to support both encoded and legacy plain-text data.
     */
    _decode(content) {
        if (!content) return content;
        try {
            // Check for our custom encoding prefix
            if (content.startsWith('ett_enc_v1:')) {
                const encoded = content.substring('ett_enc_v1:'.length);
                // Standard Base64 decode with UTF-8 support
                return decodeURIComponent(escape(atob(encoded.replace(/\s/g, ''))));
            }
            // If it's not our custom encoding, return as is (legacy support)
            return content;
        } catch (e) {
            console.error('[GitHubAPI] Decode failed:', e);
            return content;
        }
    },

    /**
     * Internal helper to encode data before sending.
     * Adds a prefix so the decoder knows how to handle it.
     */
    _encode(content) {
        if (!content) return content;
        try {
            // Apply custom encoding: UTF-8 safe Base64 with prefix
            const encoded = btoa(unescape(encodeURIComponent(content)));
            return `ett_enc_v1:${encoded}`;
        } catch (e) {
            console.error('[GitHubAPI] Encode failed:', e);
            return content;
        }
    },

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

    async getFile(path, suppressErrors = false) {
        try {
            const data = await this.request(`/contents/${path}`);
            return await this._processFileData(data, path);
        } catch (e) {
            if (e.status === 404) return null;
            if (!suppressErrors) console.error(`[GitHubAPI] getFile failed for ${path}:`, e);
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

            // Protocol: Check for legacy plain-text in storage folders
            const storageFolders = [
                'article-comments-storage',
                'created-articles-storage',
                'created-news-accounts-storage',
                'notifications-storage',
                'banned-ips.json'
            ];
            const isStorageFile = storageFolders.some(folder => path.includes(folder));
            const isLegacy = !content.startsWith('ett_enc_v1:');
            const decodedContent = this._decode(content);

            // Auto-migration: If legacy storage data is found, encode it and save back
            if (isStorageFile && isLegacy && path && data.sha) {
                console.log(`[GitHubAPI] Storage Migration Protocol: Encoding legacy data for ${path}`);
                // Run update in background so fetch is not delayed
                this.updateFile(path, decodedContent, `System: Auto-migrate legacy data to encoded format`, data.sha)
                    .catch(err => console.error(`[GitHubAPI] Migration failed for ${path}:`, err));
            }

            return {
                content: decodedContent,
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
            if (repo === 'EverythingTT-Critical-Data') {
                const data = await this.getFile(path);
                return data ? data.content : null;
            }

            // For public repo, direct raw fetch is faster and bypasses middleware queuing
            const url = this.getRawURL(path);
            const sep = url.includes('?') ? '&' : '?';
            const res = await fetch(`${url}${sep}t=${Date.now()}`);
            if (res.ok) {
                const content = await res.text();
                return this._decode(content);
            }
            return null;
        } catch (e) {
            return null;
        }
    },

    async updateFile(path, content, message, sha = null) {
        const encodedContent = this._encode(content);
        const body = {
            message,
            content: btoa(unescape(encodeURIComponent(encodedContent)))
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
        // [IMPORTANT] Now fully supported for both strings and objects
        const canUseMiddleware = this.middlewareURL && (typeof transform === 'string' || typeof transform === 'object');

        if (canUseMiddleware) {
            try {
                // If it's a string, we encode it so the middleware knows how to decode it
                const encodedTransform = typeof transform === 'string' ? this._encode(transform) : transform;

                const res = await this.request(`${path}?action=push`, 'POST', {
                    transform: encodedTransform,
                    message: message
                });
                
                const finalContentToCache = res.finalContent;
                const decodedFinalContent = this._decode(finalContentToCache);

                if (res.skipped) return { ...res, finalContent: decodedFinalContent };
                
                // Update local cache with new content
                // res.finalContent from middleware is guaranteed to be ett_enc_v1 encoded
                this._fileCache.set(`/contents/${path}`, {
                    data: {
                        content: btoa(unescape(encodeURIComponent(finalContentToCache))),
                        sha: res.content ? res.content.sha : (res.commit ? res.commit.sha : null)
                    },
                    timestamp: Date.now()
                });

                return { ...res, finalContent: decodedFinalContent };
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

    async getFolderContents(path) {
        return this.listFiles(path);
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

    DEVELOPER_ID: '845829137251567', // The unique ID of the developer

    /**
     * Checks if the current user is a BETA Tester or Developer.
     */
    isBetaTester(user) {
        if (!user) return false;
        return user.role === 'beta' || user.role === 'admin' || String(user.id) === String(this.DEVELOPER_ID);
    },

    /**
     * Renders a role badge (e.g., Admin, BETA Tester) with enhanced tooltips.
     */
    renderRoleBadge(role, className = 'admin-badge') {
        if (role === 'owner' || role === 'admin') {
            const label = role === 'owner' ? 'Owner' : 'Admin';
            const title = role === 'owner' ? 'Project Owner' : 'Administrator';
            const desc = role === 'owner' ? 'The creator and owner of the EverythingTT ecosystem.' : 'Has full access to manage the EverythingTT ecosystem.';
            const color = role === 'owner' ? '#ff4757' : '#9b59b6';

            return `
                <div class="badge-wrapper" onclick="event.stopPropagation(); this.querySelector('.badge-tooltip').classList.toggle('active')">
                    <span class="${className}" style="background: ${color};">${label}</span>
                    <div class="badge-tooltip">
                        <div class="tooltip-title">${title}</div>
                        <div class="tooltip-desc">${desc}</div>
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
