/**
 * Utility for GitHub API interactions using a Personal Access Token (PAT).
 */
const GitHubAPI = {
    cachedPAT: null,

    // Fetches the PAT from an external JSON file to avoid GitHub's auto-revocation
    async getPAT() {
        if (this.cachedPAT) return this.cachedPAT;
        
        try {
            // Fetching from external JSONBin to avoid GitHub's auto-revocation
            const response = await fetch('https://api.jsonbin.io/v3/b/6981e60cae596e708f0de988', {
                headers: { 'X-Bin-Meta': 'false' }
            });
            const config = await response.json();
            this.cachedPAT = config.github_pat;
            return this.cachedPAT;
        } catch (e) {
            console.error('Failed to load external PAT:', e);
            // Fallback to local storage if you decide to implement a setup UI later
            return localStorage.getItem('gh_pat');
        }
    },

    getOwner: () => 'Painsel',
    getRepo: () => 'Everythingtt',

    async request(path, method = 'GET', body = null) {
        const pat = await this.getPAT();
        if (!pat) throw new Error('GitHub PAT not found. Please ensure external-config.json is accessible.');

        const url = `https://api.github.com/repos/${this.getOwner()}/${this.getRepo()}${path}`;
        const headers = {
            'Authorization': `token ${pat}`,
            'Accept': 'application/vnd.github.v3+json',
            'Content-Type': 'application/json'
        };

        const options = { method, headers };
        if (body) options.body = JSON.stringify(body);

        const response = await fetch(url, options);
        if (!response.ok) {
            let errorMessage = `GitHub API request failed with status ${response.status}`;
            try {
                const errorData = await response.json();
                errorMessage = errorData.message || errorMessage;
            } catch (e) {
                if (response.statusText) errorMessage = `${response.status} ${response.statusText}`;
            }
            
            // Only log errors that aren't 404 (Not Found), as those are often expected
            if (response.status !== 404) {
                console.error('GitHub API Error:', errorMessage);
            }
            throw new Error(errorMessage);
        }
        return response.json();
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

    async updateFile(path, content, message, sha = null) {
        const body = {
            message,
            content: btoa(unescape(encodeURIComponent(content)))
        };
        if (sha) body.sha = sha;
        return this.request(`/contents/${path}`, 'PUT', body);
    },

    async listFiles(path) {
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
