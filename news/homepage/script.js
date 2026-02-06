document.addEventListener('DOMContentLoaded', async () => {
    const user = JSON.parse(localStorage.getItem('current_user'));
    if (!user) {
        window.location.href = '../index.html';
        return;
    }

    // Update sidebar and header
    const updateUIWithStatus = (u) => {
        const statusIconName = (u.statusType === 'dnd') ? 'DoNotDisturb.png' : (u.status === 'idle' ? 'Idle.png' : (u.status === 'online' ? 'Online.png' : 'Offline.png'));
        const iconPath = GitHubAPI.getStatusIconPath(statusIconName);

        document.getElementById('side-pfp').src = u.pfp;
        document.getElementById('side-username').innerText = u.username;
        
        // Add badges to sidebar username row
        const sideUsername = document.getElementById('side-username');
        let sideBadgeContainer = sideUsername.nextElementSibling;
        if (!sideBadgeContainer || !sideBadgeContainer.classList.contains('badge-container')) {
            sideBadgeContainer = document.createElement('div');
            sideBadgeContainer.className = 'badge-container';
            sideBadgeContainer.style.display = 'inline-flex';
            sideBadgeContainer.style.marginLeft = '4px';
            sideBadgeContainer.style.verticalAlign = 'middle';
            sideUsername.parentNode.insertBefore(sideBadgeContainer, sideUsername.nextSibling);
        }
        sideBadgeContainer.innerHTML = GitHubAPI.renderNewUserBadge(u.joinDate, 'user-badge side-badge');

        document.getElementById('side-status-icon').style.backgroundImage = `url('${iconPath}')`;
        
        const sideBubble = document.getElementById('side-status-bubble');
        if (u.statusMsg) {
            sideBubble.innerText = u.statusMsg;
            sideBubble.style.display = 'block';
        } else {
            sideBubble.style.display = 'none';
        }

        document.getElementById('header-pfp').src = u.pfp;
        document.getElementById('header-username').innerText = u.username;
        
        // Add badges to header username row
        const headerUsername = document.getElementById('header-username');
        let badgeContainer = headerUsername.nextElementSibling;
        if (!badgeContainer || !badgeContainer.classList.contains('badge-container')) {
            badgeContainer = document.createElement('div');
            badgeContainer.className = 'badge-container';
            badgeContainer.style.display = 'inline-flex';
            badgeContainer.style.marginLeft = '8px';
            badgeContainer.style.verticalAlign = 'middle';
            headerUsername.parentNode.insertBefore(badgeContainer, headerUsername.nextSibling);
        }
        badgeContainer.innerHTML = GitHubAPI.renderNewUserBadge(u.joinDate);

        document.getElementById('header-id').innerText = `@${u.id || u.username.toLowerCase().replace(/\s+/g, '')}`;
        document.getElementById('header-status-icon').style.backgroundImage = `url('${iconPath}')`;

        const headerBubble = document.getElementById('header-status-bubble');
        if (u.statusMsg) {
            headerBubble.innerText = u.statusMsg;
            headerBubble.style.display = 'block';
        } else {
            headerBubble.style.display = 'none';
        }
    };

    // Initial render from local storage
    const updateStats = (u) => {
        const contributions = u.contributions || 0;
        const joinDate = u.joinDate || u.createdAt;
        const formattedDate = joinDate ? new Date(joinDate).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : 'Early Member';
        
        document.getElementById('home-contributions').innerText = contributions;
        document.getElementById('home-join-date').innerText = formattedDate;
    };

    // Security check: IP Address restriction
    async function checkIP() {
        if (!user) return;
        try {
            const currentIp = await GitHubAPI.getClientIP();
            if (currentIp && user.allowedIp && currentIp !== user.allowedIp) {
                console.error('IP Mismatch detected. Logging out.');
                localStorage.removeItem('current_user');
                window.location.href = '../index.html?error=ip_mismatch';
            }
        } catch (e) {
            console.error('Failed to verify IP during session:', e);
        }
    }

    updateUIWithStatus(user);
    updateStats(user);
    document.getElementById('welcome-title').innerText = `Welcome back, ${user.username}!`;

    // Perform initial IP check
    await checkIP();

    let userSHA = null;
    let notifications = [];
    let notificationsSHA = null;

    async function pollUserProfile() {
        if (!user) return;
        try {
            const data = await GitHubAPI.getFile(`news/created-news-accounts-storage/${user.id}.json`);
            if (data) {
                userSHA = data.sha;
                const remoteUser = JSON.parse(data.content);
                remoteUser.sha = data.sha; // Preserve SHA for exit tracking

                // Update localStorage and UI if changed
                localStorage.setItem('current_user', JSON.stringify(remoteUser));
                
                // Update local user reference
                Object.assign(user, remoteUser);

                // Update UI elements with fresh data
                updateUIWithStatus(remoteUser);
                updateStats(remoteUser);
                document.getElementById('welcome-title').innerText = `Welcome back, ${remoteUser.username}!`;
                
                console.log('Account data synced from remote');
            }
        } catch (e) {
            // Profile sync failure - ignore
        }
    }

    async function pollNotifications() {
        if (!user) return;
        try {
            // Use getFileRaw for high-speed polling (check for changes without SHA)
            const content = await GitHubAPI.getFileRaw(`news/notifications-storage/${user.id}.json`);
            if (content) {
                const freshNotifications = JSON.parse(content);
                // We only need to hit the API if the data actually changed
                // (Comparing length or stringified content is a cheap way to check)
                if (JSON.stringify(freshNotifications) !== JSON.stringify(notifications)) {
                    // Fetch with API to get the latest SHA for marking as read later
                    const data = await GitHubAPI.getFile(`news/notifications-storage/${user.id}.json`);
                    if (data) {
                        notificationsSHA = data.sha;
                        notifications = JSON.parse(data.content);
                        updateNotificationUI();
                    }
                }
            }
        } catch (e) {
            if (notifications.length > 0) {
                notifications = [];
                updateNotificationUI();
            }
        }
    }

    function updateNotificationUI() {
        const badge = document.getElementById('notification-badge');
        const unreadCount = notifications.filter(n => !n.read).length;
        
        if (unreadCount > 0) {
            badge.innerText = unreadCount > 99 ? '99+' : unreadCount;
            badge.classList.remove('hidden');
        } else {
            badge.classList.add('hidden');
        }

        const list = document.getElementById('notifications-list');
        if (!list) return;

        if (notifications.length === 0) {
            list.innerHTML = '<p class="status-msg">No notifications yet.</p>';
            return;
        }

        list.innerHTML = notifications.map(n => {
            let message = "";
            switch (n.type) {
                case 'mention': message = `mentioned you in a comment on <strong>${n.articleTitle}</strong>`; break;
                case 'comment': message = `commented on your article <strong>${n.articleTitle}</strong>`; break;
                case 'reaction': message = `reacted to your article <strong>${n.articleTitle}</strong>`; break;
                case 'pin': message = `pinned your comment on <strong>${n.articleTitle}</strong>`; break;
                case 'reply': message = `replied to your comment on <strong>${n.articleTitle}</strong>`; break;
            }

            return `
                <div class="notification-item ${n.read ? 'read' : 'unread'}" onclick="handleNotificationClick('${n.id}')">
                    <img src="${n.fromUser.pfp}" class="notification-pfp">
                    <div class="notification-content">
                        <p><strong>${n.fromUser.username}</strong> ${message}</p>
                        <span class="notification-time">${new Date(n.timestamp).toLocaleString()}</span>
                    </div>
                </div>
            `;
        }).join('');
    }

    window.handleNotificationClick = async function(notificationId) {
        const n = notifications.find(notif => notif.id === notificationId);
        if (!n) return;

        // Mark as read
        n.read = true;
        updateNotificationUI();
        
        try {
            await GitHubAPI.updateFile(
                `news/notifications-storage/${user.id}.json`,
                JSON.stringify(notifications),
                `Mark notification ${notificationId} as read`,
                notificationsSHA
            );
        } catch (e) {}

        // Redirect to article page with hash
        window.location.href = `../articles/#article-${n.articleId}`;
    };

    // UI Listeners for Notifications
    const btnNotif = document.getElementById('btn-notifications');
    const notifModal = document.getElementById('notifications-modal');
    const closeNotifModal = document.querySelector('.close-notifications-modal');

    if (btnNotif) {
        btnNotif.addEventListener('click', () => {
            notifModal.classList.remove('hidden');
            updateNotificationUI();
        });
    }

    if (closeNotifModal) {
        closeNotifModal.addEventListener('click', () => {
            notifModal.classList.add('hidden');
        });
    }

    // Force sync immediately on visit
    await pollUserProfile();

    // Start background polling
    setInterval(pollUserProfile, 30000); // Poll every 30s
    setInterval(checkIP, 60000); // Poll IP every 60s
    
    // Changelog Logic
    async function checkChangelog() {
        try {
            const response = await fetch('../changelog.json?t=' + Date.now());
            if (!response.ok) return;
            const changelog = await response.json();
            const lastSeen = localStorage.getItem('last_seen_changelog');

            if (lastSeen !== changelog.version) {
                // Show modal
                const modal = document.getElementById('changelog-modal');
                const list = document.getElementById('changelog-updates-list');
                const versionTag = document.getElementById('changelog-version');

                versionTag.innerText = `Version ${changelog.version}`;
                list.innerHTML = changelog.updates.map(update => `<li>${update}</li>`).join('');
                
                modal.classList.remove('hidden');

                const closeBtn = document.getElementById('btn-close-changelog');
                const closeX = document.getElementById('close-changelog');

                const markAsSeen = () => {
                    localStorage.setItem('last_seen_changelog', changelog.version);
                    modal.classList.add('hidden');
                };

                closeBtn.onclick = markAsSeen;
                closeX.onclick = markAsSeen;
            }
        } catch (e) {
            console.error('Failed to check changelog:', e);
        }
    }

    // Check changelog on load and every 5 minutes
    checkChangelog();
    setInterval(checkChangelog, 300000);

    pollNotifications(); // Initial check
    setInterval(pollNotifications, 20000); // Poll every 20s

    const recentList = document.getElementById('recent-articles-list');
    const btnLogout = document.getElementById('btn-logout');

    btnLogout.addEventListener('click', () => {
        localStorage.removeItem('current_user');
        window.location.href = '../index.html';
    });

    // Load recent articles
    try {
        const files = await GitHubAPI.listFiles('news/created-articles-storage');
        if (!files || files.length === 0) {
            recentList.innerHTML = '<p class="empty">No news yet. Be the first to publish!</p>';
            return;
        }

        // Show much more recent articles to remove visibility limits
        const sortedFiles = files
            .filter(f => f.name.endsWith('.json'))
            .sort((a, b) => b.name.localeCompare(a.name))
            .slice(0, 50); // Increased from 5 to 50

        recentList.innerHTML = '';
        let count = 0;
        for (const file of sortedFiles) {
            if (count >= 50) break; // Increased from 5 to 50
            
            // Use getFileRaw for speed since we don't need a SHA for listing
            const content = await GitHubAPI.getFileRaw(file.path);
            if (!content) continue;
            const article = JSON.parse(content);
            
            // Skip private articles unless user is author
            if (article.isPrivate && (!user || user.id !== article.authorId)) {
                continue;
            }
            
            const item = document.createElement('div');
            item.className = 'mini-article';
            item.innerHTML = `
                <div class="mini-meta">
                    <span class="mini-title">${article.title}</span>
                    <span class="mini-author">by ${article.authorName}</span>
                </div>
                <button onclick="location.href='../articles/#article-${article.id}'">Read</button>
            `;
            recentList.appendChild(item);
            count++;
        }
    } catch (e) {
        console.error('Failed to load recent articles:', e);
        recentList.innerHTML = '<p class="error">Couldn\'t load latest updates.</p>';
    }
});
