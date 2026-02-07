const StatusManager = {
    idleTimer: null,
    idleTimeout: 300000, // 5 minutes
    currentStatus: null,
    user: null,
    onUserUpdate: null,

    async init() {
        const savedUser = localStorage.getItem('current_user');
        if (!savedUser) return;
        this.user = JSON.parse(savedUser);

        // App exit - Moved up to ensure it's always registered
        window.addEventListener('beforeunload', () => {
            this.setStatusSync('offline');
        });

        // Don't override manual DND for active session status
        if (this.user.statusType === 'dnd') {
            this.currentStatus = 'dnd';
            return;
        }

        this.setStatus('online');
        this.resetIdleTimer();

        // Activity listeners
        ['mousemove', 'mousedown', 'keypress', 'touchstart', 'scroll'].forEach(evt => {
            window.addEventListener(evt, () => this.handleActivity(), { passive: true });
        });
    },

    handleActivity() {
        if (this.user && this.user.statusType === 'dnd') return;

        if (this.currentStatus === 'idle') {
            this.setStatus('online');
        }
        this.resetIdleTimer();
    },

    resetIdleTimer() {
        clearTimeout(this.idleTimer);
        this.idleTimer = setTimeout(() => {
            if (this.user && this.user.statusType !== 'dnd') {
                this.setStatus('idle');
            }
        }, this.idleTimeout);
    },

    async setStatus(status) {
        if (this.currentStatus === status) return;
        this.currentStatus = status;

        console.log(`Setting status to: ${status}`);

        try {
            // Fetch latest user data to get SHA
            const data = await GitHubAPI.getFile(`news/created-news-accounts-storage/${this.user.id}.json`);
            if (!data) return;

            const userData = JSON.parse(data.content);
            userData.status = status;
            userData.sha = data.sha; // Save SHA for exit tracking
            // Also update lastActive
            userData.lastActive = new Date().toISOString();

            await GitHubAPI.updateFile(
                `news/created-news-accounts-storage/${this.user.id}.json`,
                JSON.stringify(userData),
                `Update status to ${status}`,
                data.sha
            );

            // Update local storage
            this.user = userData;
            localStorage.setItem('current_user', JSON.stringify(userData));

            // Notify UI if listener exists
            if (typeof this.onUserUpdate === 'function') {
                this.onUserUpdate(userData);
            }
        } catch (e) {
            console.error('Failed to update status:', e);
        }
    },

    // Synchronous-ish update for exit
    setStatusSync(status) {
        if (!this.user) return;
        
        // Use Beacon API for more reliable exit tracking
        const pat = localStorage.getItem('gh_pat');
        if (!pat) return;

        // We still need the SHA to update via GitHub API.
        // Since we can't fetch it during beforeunload, we use the last known SHA
        // that was stored in this.user when the session was active.
        
        const path = `news/created-news-accounts-storage/${this.user.id}.json`;
        const url = GitHubAPI.getAPIURL(`/contents/${path}`);
        
        const userData = {...this.user};
        userData.status = status;
        userData.lastActive = new Date().toISOString();

        const body = JSON.stringify({
            message: `Update status to ${status} (Sync)`,
            content: btoa(unescape(encodeURIComponent(JSON.stringify(userData)))),
            sha: this.user.sha
        });

        const headers = {
            'Authorization': `token ${pat}`,
            'Accept': 'application/vnd.github.v3+json',
            'Content-Type': 'application/json'
        };

        // Navigator.sendBeacon doesn't support custom headers easily for PUT
        // so we use a synchronous fetch if possible, or just fire and forget.
        fetch(url, {
            method: 'PUT',
            headers: headers,
            body: body,
            keepalive: true
        }).catch(() => {
            // Silently ignore failures on page unload
        });
    }
};

// Initialize if on a page that needs it
if (document.readyState === 'complete') {
    StatusManager.init();
} else {
    window.addEventListener('load', () => StatusManager.init());
}
