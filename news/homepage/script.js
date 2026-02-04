document.addEventListener('DOMContentLoaded', async () => {
    const user = JSON.parse(localStorage.getItem('current_user'));
    if (!user) {
        window.location.href = '../index.html';
        return;
    }

    // Update sidebar and header
    const updateUIWithStatus = (u) => {
        const statusIcon = (u.statusType === 'dnd') ? 'DoNotDisturb.png' : (u.status === 'idle' ? 'Idle.png' : (u.status === 'online' ? 'Online.png' : 'Offline.png'));
        const iconPath = `../../User Status Icons/${statusIcon}`;

        document.getElementById('side-pfp').src = u.pfp;
        document.getElementById('side-username').innerText = u.username;
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

    updateUIWithStatus(user);
    
    // Update Stats Card
    const updateStats = (u) => {
        const contributions = u.contributions || 0;
        const joinDate = u.joinDate || u.createdAt;
        const formattedDate = joinDate ? new Date(joinDate).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : 'Recently';
        
        document.getElementById('home-contributions').innerText = contributions;
        document.getElementById('home-join-date').innerText = formattedDate;
    };
    updateStats(user);
    
    document.getElementById('welcome-title').innerText = `Welcome back, ${user.username}!`;

    let userSHA = null;
    let notifications = [];
    let notificationsSHA = null;

    async function pollNotifications() {
        if (!user) return;
        try {
            const data = await GitHubAPI.getFile(`news/notifications-storage/${user.id}.json`);
            if (data && data.sha !== notificationsSHA) {
                notificationsSHA = data.sha;
                notifications = JSON.parse(data.content);
                updateNotificationUI();
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

    async function pollUserProfile() {
        if (!user) return;
        try {
            const data = await GitHubAPI.getFile(`news/created-news-accounts-storage/${user.id}.json`);
            if (data && data.sha !== userSHA) {
                userSHA = data.sha;
                const remoteUser = JSON.parse(data.content);
                
                // Update localStorage and UI if changed
                const localUser = JSON.parse(localStorage.getItem('current_user'));
                if (JSON.stringify(remoteUser) !== JSON.stringify(localUser)) {
                    localStorage.setItem('current_user', JSON.stringify(remoteUser));
                    
                    // Update UI elements
                    updateUIWithStatus(remoteUser);
                    document.getElementById('welcome-title').innerText = `Welcome back, ${remoteUser.username}!`;
                    
                    // Update stats card
                    updateStats(remoteUser);
                    
                    // Update local user reference properties
                    Object.assign(user, remoteUser);
                    console.log('Profile updated from remote');
                }
            }
        } catch (e) {
            console.error('Profile polling failed:', e);
        }
    }

    pollUserProfile(); // Initial check
    setInterval(pollUserProfile, 30000); // Poll every 30s

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

        // Sort by date (filename/ID usually correlates with date in this app)
        const sortedFiles = files
            .filter(f => f.name.endsWith('.json'))
            .sort((a, b) => b.name.localeCompare(a.name))
            .slice(0, 5); // Show last 5

        recentList.innerHTML = '';
        let count = 0;
        for (const file of sortedFiles) {
            if (count >= 5) break;
            
            const data = await GitHubAPI.getFile(file.path);
            const article = JSON.parse(data.content);
            
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
