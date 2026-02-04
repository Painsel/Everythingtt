const StatusManager = {
    idleTimer: null,
    idleTimeout: 300000, // 5 minutes
    currentStatus: null,
    user: null,

    async init() {
        const savedUser = localStorage.getItem('current_user');
        if (!savedUser) return;
        this.user = JSON.parse(savedUser);

        // Don't override manual DND
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

        // App exit
        window.addEventListener('beforeunload', () => {
            this.setStatusSync('offline');
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
        
        const url = `https://api.github.com/repos/${GitHubAPI.repoOwner}/${GitHubAPI.repoName}/contents/news/created-news-accounts-storage/${this.user.id}.json`;
        
        const userData = {...this.user};
        userData.status = status;
        userData.lastActive = new Date().toISOString();

        const body = JSON.stringify({
            message: `Update status to ${status} on exit`,
            content: btoa(unescape(encodeURIComponent(JSON.stringify(userData)))),
            sha: this.user.sha // Use last known SHA
        });

        fetch(url, {
            method: 'PUT',
            headers: {
                'Authorization': `token ${pat}`,
                'Content-Type': 'application/json'
            },
            body: body,
            keepalive: true // Crucial for beforeunload
        });
    }
};

// Initialize if on a page that needs it
if (document.readyState === 'complete') {
    StatusManager.init();
} else {
    window.addEventListener('load', () => StatusManager.init());
}
