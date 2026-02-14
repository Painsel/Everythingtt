document.addEventListener('DOMContentLoaded', async () => {
    let user = JSON.parse(localStorage.getItem('current_user'));
    if (!user) {
        window.location.href = '../index.html';
        return;
    }

    // Server-side check: Verify user still exists in storage
    if (!user.isGuest) {
        try {
            GitHubAPI.showPauseModal('Authenticating your session...');
            const verifiedUser = await GitHubAPI.syncUserProfile();
            if (!verifiedUser) {
                console.error('[Security] Account verification failed on load. Redirecting to login.');
                localStorage.removeItem('current_user');
                window.location.href = '../index.html?error=account_deleted';
                return;
            }
            user = verifiedUser; // Use the fresh data
        } catch (e) {
            console.warn('[Security] Could not verify account server-side. Continuing with cached data.', e);
        } finally {
            GitHubAPI.hidePauseModal();
        }
    }

    // Update sidebar and header
    const updateUIWithStatus = (u) => {
        const isGuest = u.isGuest === true;
        const statusIconName = isGuest ? 'Offline.png' : ((u.statusType === 'dnd') ? 'DoNotDisturb.png' : (u.status === 'idle' ? 'Idle.png' : (u.status === 'online' ? 'Online.png' : 'Offline.png')));
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

        let badges = '';
        if (isGuest) {
            badges = `<span class="user-badge guest-badge" title="Guest User">GUEST</span>`;
        } else {
            badges = `
                ${GitHubAPI.renderRoleBadge(u.role)}
                ${GitHubAPI.renderNewUserBadge(u.joinDate, 'user-badge side-badge')}
                ${GitHubAPI.renderThemeBadge('user-badge side-badge')}
            `;
        }
        sideBadgeContainer.innerHTML = badges;

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

        // Update ETT Coins display
        const ettCoinsCount = document.getElementById('ett-coins-count');
        if (ettCoinsCount) {
            ettCoinsCount.innerText = (u.ettCoins || 0).toLocaleString();
        }
        
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

        let headerBadges = '';
        if (isGuest) {
            headerBadges = `<span class="user-badge guest-badge" title="Guest User">GUEST</span>`;
        } else {
            headerBadges = `
                ${GitHubAPI.renderRoleBadge(u.role)}
                ${GitHubAPI.renderNewUserBadge(u.joinDate)}
                ${GitHubAPI.renderThemeBadge()}
            `;
        }
        badgeContainer.innerHTML = headerBadges;

        document.getElementById('header-id').innerText = isGuest ? '@guest' : `@${u.id || u.username.toLowerCase().replace(/\s+/g, '')}`;
        document.getElementById('header-status-icon').style.backgroundImage = `url('${iconPath}')`;

        const headerBubble = document.getElementById('header-status-bubble');
        if (u.statusMsg) {
            headerBubble.innerText = u.statusMsg;
            headerBubble.style.display = 'block';
        } else {
            headerBubble.style.display = 'none';
        }

        // Apply Guest restrictions
        if (isGuest) {
            const notifBtn = document.getElementById('btn-notifications');
            
            if (notifBtn) {
                notifBtn.style.opacity = '0.5';
                notifBtn.style.pointerEvents = 'none';
                notifBtn.title = 'Login to see notifications';
            }

            // Hide the "Publish News" button in the main content if it exists
            const mainPublishBtn = document.getElementById('btn-create-article');
            if (mainPublishBtn) {
                mainPublishBtn.style.display = 'none';
            }
        }
    };

    // Initial render from local storage
    const updateStats = (u) => {
        if (u.isGuest) {
            document.getElementById('home-contributions').innerText = '0';
            document.getElementById('home-join-date').innerText = 'Guest Session';
            return;
        }
        const contributions = u.contributions || 0;
        const joinDate = u.joinDate || u.createdAt;
        const formattedDate = joinDate ? new Date(joinDate).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : 'Early Member';
        
        document.getElementById('home-contributions').innerText = contributions;
        document.getElementById('home-join-date').innerText = formattedDate;
    };

    // Security check: IP Address restriction
    async function checkIP() {
        if (!user || user.isGuest) return;
        try {
            const currentIp = await GitHubAPI.getClientIP();
            const ADMIN_ID = '349106915937530';
            const isAdminOverride = String(user.id) === ADMIN_ID;

            if (currentIp && user.allowedIp && !GitHubAPI.compareIPs(user.allowedIp, currentIp)) {
                if (isAdminOverride) {
                    console.log('[Security] Admin session IP override triggered');
                    // Silently update for admin to prevent logout
                    user.allowedIp = currentIp;
                    localStorage.setItem('current_user', JSON.stringify(user));
                    
                    // Update on server
                    const data = await GitHubAPI.getFile(`created-news-accounts-storage/${user.id}.json`);
                    if (data) {
                        const serverUser = GitHubAPI.safeParse(data.content);
                        if (serverUser) {
                            serverUser.allowedIp = currentIp;
                            await GitHubAPI.updateFile(
                                `created-news-accounts-storage/${user.id}.json`,
                                JSON.stringify(serverUser),
                                `Security: Session-based admin IP update for ${user.username}`,
                                data.sha
                            );
                        }
                    }
                } else {
                    console.error('IP Mismatch detected. Logging out.');
                    localStorage.removeItem('current_user');
                    window.location.href = '../index.html?error=ip_mismatch';
                }
            } else if (currentIp && user.allowedIp && user.allowedIp !== currentIp && GitHubAPI.compareIPs(user.allowedIp, currentIp)) {
                // Dynamic IP update during session
                console.log(`[Security] Dynamic IP shift detected: ${user.allowedIp} -> ${currentIp}`);
                user.allowedIp = currentIp;
                localStorage.setItem('current_user', JSON.stringify(user));
                
                // Update on server
                const data = await GitHubAPI.getFile(`created-news-accounts-storage/${user.id}.json`);
                if (data) {
                    const serverUser = GitHubAPI.safeParse(data.content);
                    if (serverUser) {
                        serverUser.allowedIp = currentIp;
                        await GitHubAPI.updateFile(
                            `created-news-accounts-storage/${user.id}.json`,
                            JSON.stringify(serverUser),
                            `Security: Session-based dynamic IP update for ${user.username}`,
                            data.sha
                        );
                    }
                }
            }
        } catch (e) {
            console.error('Failed to verify IP during session:', e);
        }
    }

    updateUIWithStatus(user);
    updateStats(user);
    document.getElementById('welcome-title').innerText = `Welcome back, ${user.username}!`;

    // Show welcome toast if flagged
    if (localStorage.getItem('show_welcome_toast') === 'true') {
        localStorage.removeItem('show_welcome_toast');
        setTimeout(() => {
            if (window.showNotification) {
                showNotification('Welcome back!', `Logged in as ${user.username}. Glad to see you again!`, 'success');
            }
        }, 800);
    }

    // Listen for live updates from StatusManager
    if (window.StatusManager) {
        window.StatusManager.onUserUpdate = (updatedUser) => {
            console.log('[Dashboard] UI refreshed via StatusManager update');
            updateUIWithStatus(updatedUser);
            updateStats(updatedUser);
            
            // Update local user reference for other functions
            Object.assign(user, updatedUser);
        };
    }

    // Show admin panel if user is admin
    const ADMIN_ID = '845829137251567';
    if (user.id === ADMIN_ID) {
        const adminNavItem = document.getElementById('admin-nav-item');
        if (adminNavItem) adminNavItem.classList.remove('hidden');
    }

    // Perform initial IP check
    await checkIP();

    // Scan for Alt accounts with same IP
    async function scanAlts() {
        if (!user || user.isGuest) return;
        const currentIp = await GitHubAPI.getClientIP();
        if (!currentIp) return;

        try {
            const files = await GitHubAPI.listFiles('created-news-accounts-storage');
            const accountFiles = files.filter(f => f.name.endsWith('.json') && f.name !== '.gitkeep' && f.name !== `${user.id}.json`);
            
            let alts = [];
            const ADMIN_ID = '349106915937530';
            const isUserAdmin = user.id === ADMIN_ID;

            // Fetch ALL accounts with the same IP first
            for (const file of accountFiles) {
                const content = await GitHubAPI.getFileRaw(file.path);
                if (content) {
                    try {
                        // Use GitHubAPI._decode to handle potential v2 encryption consistently
                        const decodedContent = await GitHubAPI._decode(content);
                        const acc = JSON.parse(decodedContent);
                        if (acc.allowedIp === currentIp) {
                            alts.push(acc);
                        }
                    } catch (e) {
                        console.warn(`[AltScanner] Failed to parse account ${file.path}:`, e);
                    }
                }
            }

            // Enforce limits for non-admins
            if (!isUserAdmin && alts.length > 3) {
                console.warn(`[Security] Non-admin user ${user.username} has ${alts.length} alts. Enforcing limit of 3.`);
                const toKeep = alts.slice(0, 3);
                const toDelete = alts.slice(3);
                
                for (const extra of toDelete) {
                    console.log(`[Security] Deleting extra alt account: ${extra.username} (${extra.id})`);
                    await GitHubAPI.safeDeleteFile(
                        `created-news-accounts-storage/${extra.id}.json`,
                        `Security: Automatically removed extra alt account for IP enforcement (${extra.username})`
                    );
                }
                alts = toKeep;
            }

            if (alts.length > 0) {
                const switchBtn = document.getElementById('nav-switch-accounts');
                if (switchBtn) {
                    switchBtn.classList.remove('hidden');
                    switchBtn.onclick = (e) => {
                        e.preventDefault();
                        showSwitchModal(alts);
                    };
                }
            }
        } catch (e) {
            console.error('Failed to scan for alts:', e);
        }
    }

    function showSwitchModal(alts) {
        const modal = document.getElementById('switch-accounts-modal');
        const list = document.getElementById('alts-list');
        const closeBtn = document.getElementById('close-switch-modal');

        list.innerHTML = alts.map(alt => `
            <div class="alt-item" onclick="switchAccount('${alt.id}')">
                <img src="${alt.pfp}" class="alt-pfp">
                <div class="alt-info">
                    <span class="alt-username">${alt.username}</span>
                    <span class="alt-id">@${alt.id}</span>
                </div>
            </div>
        `).join('');

        modal.classList.remove('hidden');
        closeBtn.onclick = () => modal.classList.add('hidden');
        
        window.onclick = (event) => {
            if (event.target === modal) {
                modal.classList.add('hidden');
            }
        };
    }

    window.switchAccount = async (targetId) => {
        try {
            const data = await GitHubAPI.getFile(`created-news-accounts-storage/${targetId}.json`);
            if (data) {
                // getFile already handles decoding via _processFileData
                const targetUser = GitHubAPI.safeParse(data.content);
                if (targetUser) {
                    targetUser.sha = data.sha;
                    localStorage.setItem('current_user', JSON.stringify(targetUser));
                    window.location.reload();
                } else {
                    alert('Failed to parse account data.');
                }
            }
        } catch (e) {
            alert('Failed to switch account: ' + e.message);
        }
    };

    scanAlts();

    let userSHA = null;
    let notifications = [];
    let notificationsSHA = null;

    async function pollUserProfile() {
        if (!user || user.isGuest) return;
        const verifiedUser = await GitHubAPI.syncUserProfile((remoteUser) => {
            // Update local user reference
            Object.assign(user, remoteUser);

            // Update UI elements with fresh data
            updateUIWithStatus(remoteUser);
            updateStats(remoteUser);
            document.getElementById('welcome-title').innerText = `Welcome back, ${remoteUser.username}!`;
            
            console.log('Account data synced from remote');
        });

        if (!verifiedUser) {
            console.error('[Security] Account no longer exists. Redirecting to login.');
            localStorage.removeItem('current_user');
            window.location.href = '../index.html?error=account_deleted';
        }
    }

    async function pollNotifications() {
        if (!user || user.isGuest) return;
        try {
            // Use getFileRaw for high-speed polling (check for changes without SHA)
            const content = await GitHubAPI.getFileRaw(`notifications-storage/${user.id}.json`);
            if (content) {
                const freshNotifications = GitHubAPI.safeParse(content);
                if (!freshNotifications) return;
                
                // We only need to hit the API if the data actually changed
                // (Comparing length or stringified content is a cheap way to check)
                if (JSON.stringify(freshNotifications) !== JSON.stringify(notifications)) {
                    const oldUnreadCount = notifications.filter(n => !n.read).length;
                    const newUnreadCount = freshNotifications.filter(n => !n.read).length;

                    // Fetch with API to get the latest SHA for marking as read later
                    const data = await GitHubAPI.getFile(`notifications-storage/${user.id}.json`);
                    if (data) {
                        notificationsSHA = data.sha;
                        const parsedNotifications = GitHubAPI.safeParse(data.content);
                        if (parsedNotifications) {
                            notifications = parsedNotifications;
                            updateNotificationUI();

                            // Play sound if we have new unread notifications
                            if (newUnreadCount > oldUnreadCount) {
                                playNotificationSound();
                            }
                        }
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

    function playNotificationSound() {
        const savedSound = localStorage.getItem('notification_sound');
        let soundUrl = 'https://fdodsmjxbxknnqfnzdtr.supabase.co/storage/v1/object/public/AudiosAndNotifs/Notification%20Sounds/Default.mp3'; // Fallback

        if (savedSound) {
            try {
                const soundObj = JSON.parse(savedSound);
                if (soundObj.url) {
                    soundUrl = soundObj.url;
                }
            } catch (e) {
                console.warn('Failed to parse saved notification sound:', e);
            }
        }

        const audio = new Audio(soundUrl);
        audio.play().catch(err => {
            console.warn('Notification sound playback blocked or failed:', err);
        });
    }

    window.handleNotificationClick = async function(notificationId) {
        const n = notifications.find(notif => notif.id === notificationId);
        if (!n) return;

        // Mark as read
        n.read = true;
        updateNotificationUI();
        
        try {
            await GitHubAPI.updateFile(
                `notifications-storage/${user.id}.json`,
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
        GitHubAPI.hidePauseModal();
        window.location.href = '../index.html';
    });

    // Load recent articles
    try {
        const files = await GitHubAPI.listFiles('created-articles-storage');
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

            // Use GitHubAPI._decode to handle potential v2 encryption consistently
            try {
                const decodedContent = await GitHubAPI._decode(content);
                const article = JSON.parse(decodedContent);
                
                // Hide private articles from Recent News completely
                if (article.isPrivate) {
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
            } catch (parseError) {
                console.warn(`[RecentNews] Failed to parse article ${file.path}:`, parseError);
                continue;
            }
        }
    } catch (e) {
        console.error('Failed to load recent articles:', e);
        recentList.innerHTML = '<p class="error">Couldn\'t load latest updates.</p>';
    }
});
