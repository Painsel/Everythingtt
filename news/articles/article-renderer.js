document.addEventListener('DOMContentLoaded', async () => {
    const articlesList = document.getElementById('articles-list');
    const singleArticleHeader = document.getElementById('single-article-header');
    const exploreTitle = document.getElementById('explore-title');
    const btnBackToFeed = document.getElementById('btn-back-to-feed');
    const profileModal = document.getElementById('profile-modal');
    const modalContent = document.getElementById('modal-profile-content');
    const closeModal = document.querySelector('.close-modal');
    
    const commentsModal = document.getElementById('comments-modal');
    const commentsList = document.getElementById('comments-list');
    const closeCommentsModal = document.querySelector('.close-comments-modal');
    const commentInput = document.getElementById('new-comment-text');
    const btnSubmitComment = document.getElementById('btn-submit-comment');
    const commentFileUpload = document.getElementById('comment-file-upload');
    const attachmentPreview = document.getElementById('attachment-preview');
    
    // Voice Recording Elements
    const btnRecordVoice = document.getElementById('btn-record-voice');
    const voiceRecordUI = document.getElementById('voice-record-ui');
    const voiceDuration = document.getElementById('voice-duration');
    const btnCancelVoice = document.getElementById('btn-cancel-voice');
    const btnStopVoice = document.getElementById('btn-stop-voice');
    const commentAudioUpload = document.getElementById('comment-audio-upload');
    const labelAudioUpload = document.getElementById('label-audio-upload');

    let mediaRecorder = null;
    let audioChunks = [];
    let recordingInterval = null;
    let voiceDurationSeconds = 0;
    let recordedAudioBlob = null;
    
    // Banner Lightbox Elements
    const lightbox = document.getElementById('banner-lightbox');
    const lightboxImg = document.getElementById('lightbox-img');
    const closeLightbox = document.querySelector('.close-lightbox');
    
    let currentArticleIdForComments = null;
    let commentsSHA = null;
    let currentReplyToId = null;
    let currentAttachmentBase64 = null;
    let notifications = [];
    let notificationsSHA = null;

    function openBannerLightbox(url) {
        if (!lightboxImg || !lightbox) return;
        lightboxImg.src = url;
        lightbox.classList.remove('hidden');
        document.body.style.overflow = 'hidden'; // Prevent scrolling
    }

    if (closeLightbox) {
        closeLightbox.addEventListener('click', () => {
            lightbox.classList.add('hidden');
            document.body.style.overflow = '';
        });
    }

    if (lightbox) {
        lightbox.addEventListener('click', (e) => {
            if (e.target === lightbox) {
                lightbox.classList.add('hidden');
                document.body.style.overflow = '';
            }
        });
    }

    const REACTION_EMOJIS = ["🔥", "✨", "👍", "🎉", "🤣", "😂", "😃", "🤔", "🥵", "🥶", "🤡", "🤖", "💀"];
    let articleSHAs = {}; // Store SHAs for updates
    let articleData = {}; // Store local data for polling comparisons
    let userStatusCache = {}; // Cache for user status data

    // Show logged in user in sidebar if exists
    const updateSideProfileWithStatus = (u) => {
        const isGuest = u.isGuest === true;
        const statusInfo = {
            status: isGuest ? 'offline' : (u.status || 'offline'),
            statusType: isGuest ? 'auto' : (u.statusType || 'auto'),
            statusMsg: isGuest ? 'Browsing as Guest' : (u.statusMsg || '')
        };
        const iconPath = getStatusIcon(statusInfo);

        document.getElementById('side-pfp').src = u.pfp;
        document.getElementById('side-username').innerText = u.username;

        // Update ETT Coins display
        const ettCoinsCount = document.getElementById('ett-coins-count');
        if (ettCoinsCount) {
            ettCoinsCount.innerText = (u.ettCoins || 0).toLocaleString();
        }

        // Add guest badge if applicable
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

        if (isGuest) {
            sideBadgeContainer.innerHTML = `<span class="user-badge guest-badge" title="Guest User">GUEST</span>`;
        } else {
            // Check for existing badges or clear
            sideBadgeContainer.innerHTML = '';
        }

        document.getElementById('side-status-icon').style.backgroundImage = `url('${iconPath}')`;
        
        const sideBubble = document.getElementById('side-status-bubble');
        const displayStatus = isGuest ? 'Browsing as Guest' : u.statusMsg;
        if (displayStatus) {
            sideBubble.innerText = displayStatus;
            sideBubble.style.display = 'block';
        } else {
            sideBubble.style.display = 'none';
        }

        // Disable restricted navigation items for guests
        if (isGuest) {
            const publishBtn = document.querySelector('a[href="../create-article/"]');
            const settingsBtn = document.querySelector('a[href="../profile-editor/index.html"]');
            if (publishBtn) {
                publishBtn.style.opacity = '0.5';
                publishBtn.style.pointerEvents = 'none';
                publishBtn.title = 'Login to publish news';
            }
            if (settingsBtn) {
                settingsBtn.style.opacity = '0.5';
                settingsBtn.style.pointerEvents = 'none';
                settingsBtn.title = 'Login to customize profile';
            }
        }
    };

    let user = GitHubAPI.safeParse(localStorage.getItem('current_user'));
    let userSHA = null;

    // Developer ID check for global access
    const isDeveloper = user && String(user.id) === String(GitHubAPI.DEVELOPER_ID);

    // Article Management Modal Logic
    const settingsModal = document.getElementById('article-settings-modal');
    const closeSettingsModal = document.querySelector('.close-management-modal');
    const editTitle = document.getElementById('edit-article-title');
    const editContent = document.getElementById('edit-article-content');
    const editBannerPreview = document.getElementById('edit-banner-preview');
    const editBannerUpload = document.getElementById('edit-banner-upload');
    const markPrivateToggle = document.getElementById('mark-private-toggle');
    const muteUserIdInput = document.getElementById('mute-user-id');
    const muteDurationSelect = document.getElementById('mute-duration');
    const btnMuteUser = document.getElementById('btn-mute-user');
    const mutedUsersList = document.getElementById('muted-users-list');
    const btnSaveSettings = document.getElementById('btn-save-article-changes');
    const btnDeleteArticle = document.getElementById('btn-delete-article');

    // Temporary Link UI Elements
    const tempLinkSection = document.getElementById('temp-link-section');
    const btnGenerateTempLink = document.getElementById('btn-generate-temp-link');
    const tempLinkDisplay = document.getElementById('temp-link-display');
    const tempLinkInput = document.getElementById('temp-link-input');
    const btnCopyTempLink = document.getElementById('btn-copy-temp-link');
    const tempLinkStatus = document.getElementById('temp-link-status');

    // Slideshow Edit Logic
    const editBannerControls = document.getElementById('edit-banner-controls');
    const editBannerCountText = document.getElementById('edit-banner-count');
    const btnEditPrev = document.getElementById('btn-edit-prev');
    const btnEditNext = document.getElementById('btn-edit-next');
    const btnEditRemove = document.getElementById('btn-edit-remove');

    // Tab Logic
    const sidebarTabs = document.querySelectorAll('.sidebar-tab');
    const tabPanes = document.querySelectorAll('.tab-pane');

    let currentEditingArticleId = null;
    let currentEditingBannerBase64 = null;
    let editSlideshowIndex = 0;
    let editSlideshowImages = [];

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
                    user.allowedIp = currentIp;
                    localStorage.setItem('current_user', JSON.stringify(user));
                    
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

    // Changelog Modal Elements
    const changelogModal = document.getElementById('changelog-modal');
    const closeChangelogModal = document.querySelector('.close-changelog-modal');
    const btnCloseChangelog = document.getElementById('btn-close-changelog');

    async function checkChangelog() {
        try {
            const response = await fetch('../changelog.json');
            if (!response.ok) return;
            const changelog = await response.json();
            const lastSeenVersion = localStorage.getItem('last_seen_changelog_version');

            if (changelog.version !== lastSeenVersion) {
                if (changelogModal) {
                    // Update version tag
                    const versionTag = changelogModal.querySelector('.changelog-version-tag');
                    if (versionTag) versionTag.innerText = `v${changelog.version}`;

                    // Update updates list
                    const changelogList = changelogModal.querySelector('.changelog-list');
                    if (changelogList && changelog.updates) {
                        changelogList.innerHTML = changelog.updates.map(update => `<li>${update}</li>`).join('');
                    }

                    changelogModal.classList.remove('hidden');
                    
                    const saveVersion = () => {
                        localStorage.setItem('last_seen_changelog_version', changelog.version);
                        changelogModal.classList.add('hidden');
                    };

                    if (closeChangelogModal) closeChangelogModal.onclick = saveVersion;
                    if (btnCloseChangelog) btnCloseChangelog.onclick = saveVersion;
                }
            }
        } catch (e) {
            console.error('Failed to check changelog:', e);
        }
    }

    if (user) {
        const loggedInDiv = document.getElementById('logged-in-user');
        if (loggedInDiv) loggedInDiv.classList.remove('hidden');
        
        // My Articles is now public for all logged in users
        const btnMyArticles = document.getElementById('btn-my-articles');
        if (btnMyArticles) {
            btnMyArticles.classList.remove('hidden');
            // Check if we are on the My Articles page to highlight the button
            if (window.currentFilter === 'my') {
                btnMyArticles.classList.add('active');
            }
        }

        updateSideProfileWithStatus(user);
        // Initial sync
        pollUserProfile(); // Initial fetch
        pollNotifications(); // Initial notifications fetch
        checkIP(); // Initial IP check
        checkChangelog(); // Check for updates

        // SYNC: Update article author data (pfp/username) in the current page
        const updateAuthorDataInFeed = (updatedUser) => {
            const authorBlocks = document.querySelectorAll(`.author-info[data-author-id="${updatedUser.id}"]`);
            authorBlocks.forEach(block => {
                const img = block.querySelector('.author-pfp');
                const span = block.querySelector('span');
                if (img) img.src = updatedUser.pfp;
                if (span) span.innerText = window.currentFilter === 'my' ? 'You' : `By ${updatedUser.username}`;
            });

            // Also update comments if open
            const commentPfps = document.querySelectorAll(`.comment-pfp-wrapper img[onclick*="'${updatedUser.id}'"]`);
            commentPfps.forEach(img => img.src = updatedUser.pfp);
            const commentNames = document.querySelectorAll(`.comment-author-info .comment-author-name[onclick*="'${updatedUser.id}'"]`);
            commentNames.forEach(name => name.innerText = updatedUser.username);
        };

        // Hook into syncUserProfile to refresh author data if it's the current user
        const originalSync = GitHubAPI.syncUserProfile;
        GitHubAPI.syncUserProfile = async function(onUpdate) {
            return await originalSync.call(this, (newUser) => {
                updateAuthorDataInFeed(newUser);
                if (onUpdate) onUpdate(newUser);
            });
        };
    }

    async function addNotification(targetUserId, type, data) {
        if (!targetUserId || (user && targetUserId === user.id)) return; // Don't notify self

        try {
            await GitHubAPI.safeUpdateFile(
                `notifications-storage/${targetUserId}.json`,
                (content) => {
                    let remoteNotifications = [];
                    try {
                        if (content) remoteNotifications = GitHubAPI.safeParse(content) || [];
                    } catch (e) {}

                    // 1. Avoid duplicate notifications for same type/user/article
                    const isDuplicate = remoteNotifications.some(n => 
                        n.type === type && 
                        n.fromUser.id === user.id && 
                        n.articleId === data.articleId &&
                        (type !== 'reply' || n.commentId === data.commentId)
                    );
                    
                    if (isDuplicate) {
                        // Update timestamp of existing notification instead of adding new one
                        const existingIndex = remoteNotifications.findIndex(n => 
                            n.type === type && 
                            n.fromUser.id === user.id && 
                            n.articleId === data.articleId &&
                            (type !== 'reply' || n.commentId === data.commentId)
                        );
                        if (existingIndex !== -1) {
                            remoteNotifications[existingIndex].timestamp = new Date().toISOString();
                            remoteNotifications[existingIndex].read = false;
                            // Move to top
                            const updatedNotif = remoteNotifications.splice(existingIndex, 1)[0];
                            remoteNotifications.unshift(updatedNotif);
                        }
                        return JSON.stringify(remoteNotifications);
                    }

                    const newNotif = {
                        id: GitHubAPI.generateID().toString(),
                        type: type,
                        fromUser: {
                            id: user.id,
                            username: user.username,
                            pfp: user.pfp
                        },
                        articleId: data.articleId,
                        articleTitle: data.articleTitle,
                        commentId: data.commentId || null,
                        text: data.text || "",
                        timestamp: new Date().toISOString(),
                        read: false
                    };

                    remoteNotifications.unshift(newNotif); // Newest first
                    
                    // 2. Limit notification storage to 100 items (more than enough for most users)
                    if (remoteNotifications.length > 100) {
                        remoteNotifications = remoteNotifications.slice(0, 100);
                    }
                    return JSON.stringify(remoteNotifications);
                },
                `New notification for ${targetUserId}`
            );
        } catch (e) {
            // Notification fetch failure - ignore
        }
    }

    async function fetchUserStatus(userId) {
        if (userStatusCache[userId]) return userStatusCache[userId];
        
        try {
            const data = await GitHubAPI.getFile(`created-news-accounts-storage/${userId}.json`);
            if (data) {
                const userData = GitHubAPI.safeParse(data.content);
                if (userData) {
                    userStatusCache[userId] = {
                        status: userData.status || 'offline',
                        statusType: userData.statusType || 'auto',
                        statusMsg: userData.statusMsg || '',
                        joinDate: userData.joinDate || null
                    };
                    return userStatusCache[userId];
                }
            }
        } catch (e) {
            // Silently fail status fetch
        }
        return { status: 'offline', statusType: 'auto', statusMsg: '' };
    }

    function getStatusIcon(statusInfo) {
        const type = statusInfo.statusType;
        const status = statusInfo.status;
        
        let iconName = 'Offline.png';
        if (type === 'dnd') {
            iconName = 'DoNotDisturb.png';
        } else if (status === 'online') {
            iconName = 'Online.png';
        } else if (status === 'idle') {
            iconName = 'Idle.png';
        }
        
        return GitHubAPI.getStatusIconPath(iconName);
    }

    let notificationsInitialized = false;
    async function pollNotifications() {
        if (!user || user.isGuest) return;
        try {
            // Using a try-catch and suppressErrors to avoid console noise for expected 404s
            const data = await GitHubAPI.getFile(`notifications-storage/${user.id}.json`, true);
            if (data && data.sha !== notificationsSHA) {
                const freshNotifications = GitHubAPI.safeParse(data.content) || [];
                const oldUnreadCount = notifications.filter(n => !n.read).length;
                const newUnreadCount = freshNotifications.filter(n => !n.read).length;

                notificationsSHA = data.sha;
                notifications = freshNotifications;
                updateNotificationUI();

                // Play sound if we have new unread notifications
                if (newUnreadCount > oldUnreadCount) {
                    playNotificationSound();
                }
            } else if (!data && !notificationsInitialized) {
                // If the file doesn't exist, create an empty one to stop 404 console noise
                notificationsInitialized = true;
                console.log('[ArticleRenderer] Initializing notification storage for user...');
                await GitHubAPI.updateFile(
                    `notifications-storage/${user.id}.json`,
                    '[]',
                    `System: Initialize notifications for ${user.username}`
                );
            }
        } catch (e) {
            // Silently handle - the 404 is expected for new users
            if (notifications.length > 0) {
                notifications = [];
                updateNotificationUI();
            }
        }
    }

    function playNotificationSound() {
        const savedSound = localStorage.getItem('notification_sound');
        let soundUrl = 'https://fdodsmjxbxknnqfnzdtr.supabase.co/storage/v1/object/public/AudiosAndNotifs/Notification%20Sounds/Default.mp3'; // Fallback

        if (savedSound) {
            try {
                const soundObj = GitHubAPI.safeParse(savedSound);
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

    function updateNotificationUI() {
        const badge = document.getElementById('notification-badge');
        const unreadCount = notifications.filter(n => !n.read).length;
        
        if (badge) {
            if (unreadCount > 0) {
                badge.innerText = unreadCount > 99 ? '99+' : unreadCount;
                badge.classList.remove('hidden');
            } else {
                badge.classList.add('hidden');
            }
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

        // Optimistic UI
        n.read = true;
        updateNotificationUI();
        
        try {
            await GitHubAPI.safeUpdateFile(
                `notifications-storage/${user.id}.json`,
                (content) => {
                    if (!content) return JSON.stringify(notifications);
                    const remoteNotifs = GitHubAPI.safeParse(content) || [];
                    const target = remoteNotifs.find(notif => notif.id === notificationId);
                    if (target) target.read = true;
                    return JSON.stringify(remoteNotifs);
                },
                `Mark notification ${notificationId} as read`
            );
        } catch (e) {
            console.error('Failed to update notification read status:', e);
        }

        // Redirect and highlight
        window.location.hash = `#article-${n.articleId}`;
        
        // Wait for article to load then open comments and highlight
        setTimeout(async () => {
            await openComments(n.articleId, n.articleTitle);
            if (n.commentId) {
                setTimeout(() => {
                    const commentEl = document.getElementById(`comment-${n.commentId}`);
                    if (commentEl) {
                        commentEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        commentEl.classList.add('highlight-comment');
                        setTimeout(() => commentEl.classList.remove('highlight-comment'), 2000);
                    }
                }, 500);
            }
        }, 500);

        document.getElementById('notifications-modal').classList.add('hidden');
    };

    // UI Listeners for Notifications
    const btnNotif = document.getElementById('btn-notifications');
    const btnMyArticles = document.getElementById('btn-my-articles');
    const notifModal = document.getElementById('notifications-modal');
    const closeNotifModal = document.querySelector('.close-notifications-modal');

    window.currentFilter = window.currentFilter || 'all';

    if (btnNotif) {
        btnNotif.addEventListener('click', () => {
            notifModal.classList.remove('hidden');
            updateNotificationUI();
        });
    }

    if (btnMyArticles) {
         btnMyArticles.addEventListener('click', () => {
             window.location.href = '../my-articles/';
         });
     }

    if (closeNotifModal) {
        closeNotifModal.addEventListener('click', () => {
            notifModal.classList.add('hidden');
        });
    }

    async function pollUserProfile() {
        if (!user || user.isGuest) return;
        const verifiedUser = await GitHubAPI.syncUserProfile((remoteUser) => {
            // Update local user reference properties
            Object.assign(user, remoteUser);
            
            // Update sidebar UI
            updateSideProfileWithStatus(remoteUser);
            
            console.log('Profile updated from remote');
        });

        if (!verifiedUser) {
            console.error('[Security] Account no longer exists. Redirecting to login.');
            localStorage.removeItem('current_user');
            window.location.href = '../index.html?error=account_deleted';
        }
    }

    // Load articles
    async function loadArticles() {
        const hash = window.location.hash;
        const singleArticleId = hash.split('?')[0].replace('#article-', '');
        const isSingleArticle = hash.startsWith('#article-');
        
        try {
            articlesList.innerHTML = '<p class="status-msg">Loading articles...</p>';
            
            if (isSingleArticle) {
                // Single article view
                document.body.classList.add('single-article-view');
                if (singleArticleHeader) singleArticleHeader.classList.remove('hidden');
                if (exploreTitle) exploreTitle.classList.add('hidden');
                
                const data = await GitHubAPI.getFile(`created-articles-storage/${singleArticleId}.json`);
                if (!data) {
                    articlesList.innerHTML = '<p class="status-msg">Article not found.</p>';
                    return;
                }
                
                const article = GitHubAPI.safeParse(data.content);
                if (!article) {
                    articlesList.innerHTML = '<p class="status-msg">Failed to load article data.</p>';
                    return;
                }
                
                // Private check for single view
                let hasTempAccess = false;
                const urlParams = new URLSearchParams(window.location.search);
                const accessToken = urlParams.get('access');

                if (accessToken) {
                    try {
                        // Check temp-access-links (rerouted to critical storage automatically)
                        const tempAccessData = await GitHubAPI.getFile(`temp-access-links/${accessToken}.json`);
                        if (tempAccessData) {
                            const accessInfo = GitHubAPI.safeParse(tempAccessData.content);
                            if (accessInfo && accessInfo.articleId === singleArticleId && accessInfo.expiry > Date.now()) {
                                hasTempAccess = true;
                            }
                        }
                    } catch (e) {
                        console.warn('Temporary access token validation failed:', e);
                    }
                }

                if (article.isPrivate && !hasTempAccess && (!user || String(user.id) !== String(article.authorId))) {
                    articlesList.innerHTML = '<p class="status-msg">This article is private and can only be viewed by the author or via a temporary access link.</p>';
                    return;
                }

                articleSHAs[article.id] = data.sha;
                articleData[article.id] = article;
                articlesList.innerHTML = '';
                renderArticleCard(article, true); // true for full view
            } else {
                // Feed view
                document.body.classList.remove('single-article-view');
                if (singleArticleHeader) singleArticleHeader.classList.add('hidden');
                if (exploreTitle) exploreTitle.classList.remove('hidden');
                
                const files = await GitHubAPI.listFiles('created-articles-storage');
                console.log(`Raw files from listFiles:`, files);
                
                if (!files || files.length === 0) {
                    articlesList.innerHTML = '<p class="status-msg">No articles found. Be the first to publish!</p>';
                    return;
                }

                articlesList.innerHTML = ''; // Clear loading message
                // Sort by timestamp descending
                const articleFiles = files.filter(f => f.type === 'file' && f.name.endsWith('.json'));
                console.log(`Filtered article files:`, articleFiles);
                
                // Fetch all articles
                const articles = await Promise.all(articleFiles.map(async (file) => {
                    console.log(`Fetching article content for: ${file.path}`);
                    const data = await GitHubAPI.getFile(file.path);
                    if (!data) {
                        console.warn(`No data returned for article: ${file.path}`);
                        return null;
                    }
                    try {
                        const content = data.content;
                        // Safety check for encoded data
                        if (content.startsWith('ett_enc_v2:') && typeof CryptoJS === 'undefined') {
                            console.warn(`[ArticleRenderer] CryptoJS missing, skipping encoded article: ${file.path}`);
                            return null;
                        }

                        // Use GitHubAPI.safeParse to handle potential v2 encryption consistently
                        const article = GitHubAPI.safeParse(content);
                        if (article) {
                            article.sha = data.sha;
                            console.log(`Successfully loaded article: ${article.title} (${article.id})`);
                        }
                        return article;
                    } catch (e) { 
                        console.error(`Failed to parse article JSON for ${file.path}:`, e);
                        // Log snippet of content for debugging
                        if (data.content) console.error(`Content snippet: ${data.content.substring(0, 50)}`);
                        return null; 
                    }
                }));

                const validArticles = articles.filter(a => a !== null);
                console.log(`Total valid articles: ${validArticles.length}`);

                const filteredArticles = validArticles
                    .filter(a => {
                        // Developer ID and Author can see private articles in Feed if "My Articles" filter is active
                        // Private articles restriction (BETA Feature)
                        if (a.isPrivate) {
                            // Render private articles only in "My Articles" filter for the author or developer
                            if (window.currentFilter === 'my') {
                                return String(a.authorId) === String(user.id);
                            }
                            // In general feed, they are hidden
                            return false; 
                        }

                        // "My Articles" filter check
                        if (window.currentFilter === 'my' && user) {
                            return String(a.authorId) === String(user.id);
                        }

                        return true;
                    })
                    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
                
                console.log(`Articles after privacy filtering: ${filteredArticles.length}`);
                
                if (filteredArticles.length === 0) {
                    articlesList.innerHTML = '<p class="status-msg">No visible articles found.</p>';
                } else {
                    for (const article of filteredArticles) {
                        articleSHAs[article.id] = article.sha;
                        articleData[article.id] = article;
                        renderArticleCard(article, false);
                    }
                }
            }

            // Global click handler to close emoji pickers
            document.addEventListener('click', (e) => {
                if (!e.target.closest('.add-reaction') && !e.target.closest('.emoji-picker')) {
                    document.querySelectorAll('.emoji-picker').forEach(p => p.classList.add('hidden'));
                }
            });

            // Start real-time polling
            if (!window.pollingInterval) {
                window.pollingInterval = setInterval(pollReactions, 15000);
                window.profilePollingInterval = setInterval(pollUserProfile, 30000); // Check profile every 30s
                window.notificationPollingInterval = setInterval(pollNotifications, 30000); // Check notifications every 30s (reduced frequency for V2 stability)
                window.ipPollingInterval = setInterval(checkIP, 60000); // Check IP every 60s
            }
        } finally {
            GitHubAPI.hidePauseModal();
        }
    }

    // Initial load
    loadArticles().then(() => {
        // Migration: Sync comment counts for all loaded articles if needed
        if (user) {
            console.log('Starting background comment count migration...');
            const articlesToSync = Object.values(articleData);
            articlesToSync.forEach(article => {
                // Check if commentCount is missing
                if (article.commentCount === undefined) {
                    (async () => {
                        try {
                            const data = await GitHubAPI.getFile(`article-comments-storage/${article.id}.json`);
                            const parsedData = data ? GitHubAPI.safeParse(data.content) : [];
                            const count = Array.isArray(parsedData) ? parsedData.length : 0;
                            console.log(`Migrating article ${article.id}: setting count to ${count}`);
                            await syncCommentCount(article.id, count);
                        } catch (e) {
                            // File might not exist, which means 0 comments
                            console.log(`Migrating article ${article.id}: setting count to 0 (no comments file)`);
                            await syncCommentCount(article.id, 0);
                        }
                    })();
                }
            });
        }
    }).finally(() => {
        GitHubAPI.hidePauseModal();
    });

    // Article Management Modal
    // Article Management Modal Logic

    function updateEditBannerPreview() {
        if (!editBannerPreview || !editBannerCountText || !editBannerControls) return;
        if (editSlideshowImages.length > 0) {
            const currentImg = editSlideshowImages[editSlideshowIndex];
            editBannerPreview.src = (currentImg && !currentImg.startsWith('#')) ? currentImg : 'https://placehold.co/400x150';
            editBannerCountText.innerText = `${editSlideshowIndex + 1} / ${editSlideshowImages.length}`;
            editBannerControls.classList.remove('hidden');
        } else {
            editBannerPreview.src = 'https://placehold.co/400x150';
            editBannerCountText.innerText = '0 / 0';
            editBannerControls.classList.add('hidden');
        }
    }

    if (btnEditPrev) {
        btnEditPrev.addEventListener('click', (e) => {
            e.preventDefault();
            if (editSlideshowImages.length <= 1) return;
            editSlideshowIndex = (editSlideshowIndex - 1 + editSlideshowImages.length) % editSlideshowImages.length;
            updateEditBannerPreview();
        });
    }

    if (btnEditNext) {
        btnEditNext.addEventListener('click', (e) => {
            e.preventDefault();
            if (editSlideshowImages.length <= 1) return;
            editSlideshowIndex = (editSlideshowIndex + 1) % editSlideshowImages.length;
            updateEditBannerPreview();
        });
    }

    if (btnEditRemove) {
        btnEditRemove.addEventListener('click', (e) => {
            e.preventDefault();
            if (editSlideshowImages.length === 0) return;
            editSlideshowImages.splice(editSlideshowIndex, 1);
            if (editSlideshowIndex >= editSlideshowImages.length && editSlideshowImages.length > 0) {
                editSlideshowIndex = editSlideshowImages.length - 1;
            } else if (editSlideshowImages.length === 0) {
                editSlideshowIndex = 0;
            }
            updateEditBannerPreview();
        });
    }

    // Tab Logic

    if (sidebarTabs) {
        sidebarTabs.forEach(tab => {
            tab.addEventListener('click', () => {
                const targetTab = tab.getAttribute('data-tab');
                
                // Update tabs
                sidebarTabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');

                // Update panes
                if (tabPanes) {
                    tabPanes.forEach(pane => {
                        pane.classList.remove('active');
                        if (pane.id === `tab-${targetTab}`) {
                            pane.classList.add('active');
                        }
                    });
                }
            });
        });
    }

    async function openArticleSettings(articleId) {
        if (!settingsModal || !user || user.isGuest) return;
        currentEditingArticleId = articleId;
        const article = articleData[articleId];
        if (!article || String(article.authorId) !== String(user.id)) return;

        // Reset to first tab
        if (sidebarTabs && sidebarTabs[0]) sidebarTabs[0].click();

        if (editTitle) editTitle.value = article.title;
        if (editContent) editContent.value = article.content;
        
        // Handle banner preview (handle both single string and array/slideshow)
        editSlideshowImages = Array.isArray(article.banner) ? [...article.banner] : (article.banner ? [article.banner] : []);
        editSlideshowIndex = 0;
        updateEditBannerPreview();
        
        if (markPrivateToggle) markPrivateToggle.checked = !!article.isPrivate;
        
        // Handle Temporary Link Section visibility
        if (tempLinkSection) {
            if (article.isPrivate) {
                tempLinkSection.classList.remove('hidden');
                if (tempLinkDisplay) tempLinkDisplay.classList.add('hidden');
                if (tempLinkStatus) tempLinkStatus.innerText = '';
            } else {
                tempLinkSection.classList.add('hidden');
            }

            // Toggle visibility when checkbox changes
            if (markPrivateToggle) {
                markPrivateToggle.onchange = () => {
                    if (markPrivateToggle.checked) {
                        tempLinkSection.classList.remove('hidden');
                    } else {
                        tempLinkSection.classList.add('hidden');
                    }
                };
            }
        }

        // Slideshow is now public
        const bannerSection = document.querySelector('.banner-edit-container');
        if (bannerSection) {
            const bannerUpload = document.getElementById('edit-banner-upload');
            if (bannerUpload) bannerUpload.multiple = true;
        }

        currentEditingBannerBase64 = article.banner; // Deprecated but kept for compatibility during save if needed
        // Note: we now use editSlideshowImages as the source of truth during editing

        if (mutedUsersList) renderMutedUsers(article.mutes || {});

        settingsModal.classList.remove('hidden');
    }

    function renderMutedUsers(mutes) {
        mutedUsersList.innerHTML = '';
        const now = Date.now();
        const entries = Object.entries(mutes);
        
        if (entries.length === 0) {
            mutedUsersList.innerHTML = '<p class="help-text" style="text-align:center; padding: 10px;">No users muted on this article.</p>';
            return;
        }

        entries.forEach(([userId, expiry]) => {
            if (expiry !== 'permanent' && parseInt(expiry) < now) return;
            
            const card = document.createElement('div');
            card.className = 'muted-user-card';
            card.innerHTML = `
                <div class="user-mute-info">
                    <span class="user-id-text">User ID: ${userId}</span>
                    <span class="expiry-text">${expiry === 'permanent' ? 'Permanently Muted' : `Muted until ${new Date(parseInt(expiry)).toLocaleString()}`}</span>
                </div>
                <button class="unmute-action-btn" onclick="handleUnmute('${userId}')">Unmute</button>
            `;
            mutedUsersList.appendChild(card);
        });
    }

    window.handleUnmute = async function handleMuteUser() {
        if (!currentEditingArticleId || !user) return;
        
        const article = articleData[currentEditingArticleId];
        if (!article || (String(article.authorId) !== String(user.id))) return;

        if (article.mutes && article.mutes[userId]) {
            const oldMutes = { ...article.mutes };
            delete article.mutes[userId];
            renderMutedUsers(article.mutes);

            try {
                await GitHubAPI.safeUpdateFile(
                    `created-articles-storage/${currentEditingArticleId}.json`,
                    (content) => {
                        const data = GitHubAPI.safeParse(content);
                        if (!data) return content;
                        if (!data.mutes) data.mutes = {};
                        delete data.mutes[userId];
                        return JSON.stringify(data);
                    },
                    `Unmute user ${userId} on article ${currentEditingArticleId}`
                );
            } catch (e) {
                console.error('Failed to unmute on GitHub:', e);
                article.mutes = oldMutes; // Revert on failure
                renderMutedUsers(article.mutes);
                alert('Failed to save unmute: ' + e.message);
            }
        }
    };

    if (btnMuteUser) {
        btnMuteUser.addEventListener('click', async () => {
            if (!currentEditingArticleId || !user) return;
            const targetId = muteUserIdInput ? muteUserIdInput.value.trim() : null;
            const duration = muteDurationSelect ? muteDurationSelect.value : null;
            if (!targetId) return alert('Please enter a User ID');

            btnMuteUser.disabled = true;
            btnMuteUser.innerText = 'Muting...';

            try {
                const res = await GitHubAPI.safeUpdateFile(
                    `created-articles-storage/${currentEditingArticleId}.json`,
                    (content) => {
                        let article = GitHubAPI.safeParse(content);
                        if (!article) return content;
                        if (!article.mutes) article.mutes = {};
                        
                        const expiry = duration === 'permanent' ? 'permanent' : (Date.now() + (parseInt(duration) * 1000));
                        article.mutes[targetId] = expiry;
                        
                        return JSON.stringify(article);
                    },
                    `Mute user ${targetId} on article ${currentEditingArticleId}`
                );

                if (res.finalContent) {
                    const updated = GitHubAPI.safeParse(res.finalContent);
                    if (updated) {
                        articleData[currentEditingArticleId] = updated;
                        if (mutedUsersList) renderMutedUsers(updated.mutes);
                        if (muteUserIdInput) muteUserIdInput.value = '';
                    }
                }
            } catch (e) {
                console.error('Mute failed:', e);
                alert('Failed to mute user: ' + e.message);
            } finally {
                btnMuteUser.disabled = false;
                btnMuteUser.innerText = 'Mute';
            }
        });
    }

    // Temporary Link Generation Logic
    if (btnGenerateTempLink) {
        btnGenerateTempLink.addEventListener('click', async () => {
            if (!currentEditingArticleId || !user) return;
            
            const article = articleData[currentEditingArticleId];
            if (!article || String(article.authorId) !== String(user.id)) return;

            btnGenerateTempLink.disabled = true;
            btnGenerateTempLink.innerText = 'Generating...';
            if (tempLinkStatus) {
                tempLinkStatus.innerText = 'Creating temporary access token...';
                tempLinkStatus.className = 'temp-link-status';
            }

            try {
                const token = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
                const expiry = Date.now() + (60 * 60 * 1000); // 1 hour from now

                const accessData = {
                    articleId: currentEditingArticleId,
                    token: token,
                    expiry: expiry,
                    createdBy: user.id,
                    createdAt: new Date().toISOString()
                };

                // Save the token to GitHub storage - Now rerouted to critical storage via the path change
                await GitHubAPI.safeUpdateFile(
                    `temp-access-links/${token}.json`,
                    accessData,
                    `Generate temporary link for article: ${currentEditingArticleId}`
                );

                // Construct the link - Always point to the main articles page
                let baseUrl = window.location.href.split('#')[0].split('?')[0];
                if (baseUrl.includes('/my-articles/')) {
                    baseUrl = baseUrl.replace('/my-articles/', '/articles/');
                }
                const tempLink = `${baseUrl}?access=${token}#article-${currentEditingArticleId}`;
                
                if (tempLinkInput) tempLinkInput.value = tempLink;
                if (tempLinkDisplay) tempLinkDisplay.classList.remove('hidden');
                if (tempLinkStatus) {
                    tempLinkStatus.innerText = 'Link generated! Valid for 1 hour.';
                    tempLinkStatus.className = 'temp-link-status success';
                }
            } catch (e) {
                console.error('Failed to generate temporary link:', e);
                if (tempLinkStatus) {
                    tempLinkStatus.innerText = 'Error: ' + e.message;
                    tempLinkStatus.className = 'temp-link-status error';
                }
            } finally {
                btnGenerateTempLink.disabled = false;
                btnGenerateTempLink.innerText = 'Generate Link';
            }
        });
    }

    if (btnCopyTempLink) {
        btnCopyTempLink.addEventListener('click', () => {
            if (tempLinkInput) {
                tempLinkInput.select();
                document.execCommand('copy');
                const originalText = btnCopyTempLink.innerText;
                btnCopyTempLink.innerText = 'Copied!';
                setTimeout(() => {
                    btnCopyTempLink.innerText = originalText;
                }, 2000);
            }
        });
    }

    if (closeSettingsModal) {
        closeSettingsModal.addEventListener('click', () => {
            if (settingsModal) settingsModal.classList.add('hidden');
            currentEditingArticleId = null;
            currentEditingBannerBase64 = null;
        });
    }

    if (editBannerUpload) {
        editBannerUpload.addEventListener('change', async (e) => {
            const files = Array.from(e.target.files);
            if (files.length === 0) return;

            // BETA limit: 5 images
            if (editSlideshowImages.length + files.length > 5) {
                alert('BETA Testers can add up to 5 images for a slideshow.');
                return;
            }

            for (const file of files) {
                const reader = new FileReader();
                const promise = new Promise((resolve) => {
                    reader.onload = (event) => {
                        editSlideshowImages.push(event.target.result);
                        resolve();
                    };
                });
                reader.readAsDataURL(file);
                await promise;
            }
            
            editSlideshowIndex = editSlideshowImages.length - 1;
            updateEditBannerPreview();
        });
    }

    if (btnSaveSettings) {
        btnSaveSettings.addEventListener('click', async () => {
            if (!currentEditingArticleId || !user) return;

            // Extra safety check
            const localArticle = articleData[currentEditingArticleId];
            if (!localArticle || String(localArticle.authorId) !== String(user.id)) {
                return alert('You do not have permission to edit this article.');
            }

            btnSaveSettings.disabled = true;
            btnSaveSettings.innerText = 'Saving...';

            try {
                GitHubAPI.showPauseModal('Syncing article changes...');
                // Get latest UI state for mutes
                const currentMutes = localArticle.mutes || {};

                // Decide banner format: single string if 1 image, array if multiple
                const finalBanner = editSlideshowImages.length > 1 ? editSlideshowImages : (editSlideshowImages[0] || null);

                const res = await GitHubAPI.safeUpdateFile(
                    `created-articles-storage/${currentEditingArticleId}.json`,
                    {
                        title: editTitle ? editTitle.value.trim() : localArticle.title,
                        content: editContent ? editContent.value.trim() : localArticle.content,
                        banner: finalBanner,
                        isPrivate: markPrivateToggle ? markPrivateToggle.checked : (localArticle.isPrivate || false),
                        mutes: currentMutes,
                        lastUpdated: new Date().toISOString()
                    },
                    `Update article: ${editTitle ? editTitle.value.trim() : currentEditingArticleId}`
                );
                
                if (res.finalContent) {
                    const finalArticle = GitHubAPI.safeParse(res.finalContent);
                    if (finalArticle) {
                        // Update local state
                        articleData[currentEditingArticleId] = finalArticle;
                        articleSHAs[currentEditingArticleId] = res.content.sha;
                        
                        // Reload or update UI
                        if (settingsModal) settingsModal.classList.add('hidden');
                        loadArticles(); // Refresh to show changes
                        alert('Article updated successfully!');
                    }
                }
            } catch (e) {
                console.error('Failed to update article:', e);
                alert('Failed to save changes: ' + e.message);
            } finally {
                GitHubAPI.hidePauseModal();
                btnSaveSettings.disabled = false;
                btnSaveSettings.innerText = 'Save Changes';
            }
        });
    }

    if (btnDeleteArticle) {
        btnDeleteArticle.addEventListener('click', async () => {
            if (!currentEditingArticleId || !user) return;

            // Extra safety check
            const localArticle = articleData[currentEditingArticleId];
            if (!localArticle || String(localArticle.authorId) !== String(user.id)) {
                return alert('You do not have permission to delete this article.');
            }

            if (!confirm('Are you absolutely sure you want to delete this article? This action cannot be undone.')) {
                return;
            }

            btnDeleteArticle.disabled = true;
            btnDeleteArticle.innerText = 'Deleting...';

            try {
                GitHubAPI.showPauseModal('Deleting article and associated comments...');
                // 1. Fetch latest SHA to ensure we can delete without conflict
                const latest = await GitHubAPI.getFile(`created-articles-storage/${currentEditingArticleId}.json`);
                if (!latest) throw new Error('Could not find article to delete.');
                
                const currentSha = latest.sha;

                // 2. Delete article file
                await GitHubAPI.request(`/contents/created-articles-storage/${currentEditingArticleId}.json`, 'DELETE', {
                    message: `Delete article: ${currentEditingArticleId}`,
                    sha: currentSha
                });

                // 3. Optionally delete comments file
                try {
                    const commentsRes = await GitHubAPI.getFile(`article-comments-storage/${currentEditingArticleId}.json`);
                    if (commentsRes) {
                        await GitHubAPI.request(`/contents/article-comments-storage/${currentEditingArticleId}.json`, 'DELETE', {
                            message: `Delete comments for article: ${currentEditingArticleId}`,
                            sha: commentsRes.sha
                        });
                    }
                } catch (e) {
                    console.warn('Comments file deletion skipped or failed:', e);
                }

                // 4. Update user contributions count
                try {
                    const userData = await GitHubAPI.getFile(`created-news-accounts-storage/${user.id}.json`);
                    if (userData) {
                        const profile = GitHubAPI.safeParse(userData.content);
                        if (profile) {
                            profile.contributions = Math.max(0, (profile.contributions || 1) - 1);
                            await GitHubAPI.updateFile(
                                `created-news-accounts-storage/${user.id}.json`,
                                JSON.stringify(profile),
                                `Decrement contributions for ${user.username}`,
                                userData.sha
                            );
                            localStorage.setItem('current_user', JSON.stringify(profile));
                        }
                    }
                } catch (e) {
                    console.warn('Failed to update contributions count:', e);
                }

                // 5. Cleanup local state
                delete articleData[currentEditingArticleId];
                delete articleSHAs[currentEditingArticleId];
                
                // 6. UI Update
                if (settingsModal) settingsModal.classList.add('hidden');
                
                // If we are in single view, go back to feed
                if (window.location.hash.includes(currentEditingArticleId)) {
                    window.location.hash = '';
                } else {
                    // Just remove the card if in feed view for better responsiveness
                    const card = document.getElementById(`article-${currentEditingArticleId}`);
                    if (card) card.remove();
                }

                alert('Article deleted successfully.');
                loadArticles(); // Final refresh to be sure
            } catch (e) {
                console.error('Failed to delete article:', e);
                alert('Failed to delete article: ' + e.message);
            } finally {
                GitHubAPI.hidePauseModal();
                btnDeleteArticle.disabled = false;
                btnDeleteArticle.innerText = 'Delete Article';
            }
        });
    }
 
     // Listen for hash changes to switch between single and feed view
     window.addEventListener('hashchange', loadArticles);
 
     // Back to feed button
    if (btnBackToFeed) {
        btnBackToFeed.addEventListener('click', () => {
            window.location.hash = '';
        });
    }

    function formatArticleContent(text) {
        if (!text) return '';
        
        // Escape HTML to prevent XSS
        let formatted = text
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");

        // Inline elements (before block elements to handle content within blocks)
        
        // Custom Colors: /color text
        const colors = ['red', 'blue', 'violet', 'yellow', 'green'];
        colors.forEach(color => {
            const regex = new RegExp(`/${color} (.*?)(?=\\s/|\\s$|$)`, 'g');
            formatted = formatted.replace(regex, `<span class="text-${color}">$1</span>`);
        });

        // Bold: **Text**
        formatted = formatted.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        
        // Italic: *Text*
        formatted = formatted.replace(/\*(.*?)\*/g, '<em>$1</em>');

        // User Mentions: @username or @[user name]
        formatted = formatted.replace(/@\[(.*?)\]/g, (match, username) => {
            return `<span class="mention" onclick="findAndShowUser('${username.replace(/'/g, "\\'")}')">@${username}</span>`;
        });
        formatted = formatted.replace(/@([a-zA-Z0-9_]+)/g, '<span class="mention" onclick="findAndShowUser(\'$1\')">@$1</span>');

        // Images: ![Alt](URL)
        formatted = formatted.replace(/!\[(.*?)\]\((.*?)\)/g, '<img src="$2" alt="$1" class="article-embedded-image">');

        // Links: [Text](URL)
        formatted = formatted.replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" class="article-link">$1</a>');

        // Horizontal Rules: ---
        formatted = formatted.replace(/^---$/gm, '<hr class="article-divider">');

        // Process line by line for block-level elements
        let lines = formatted.split('\n');
        let processedLines = lines.map(line => {
            const trimmedLine = line.trim();
            // Headers: # Big Text
            if (trimmedLine.startsWith('# ')) {
                return `<h1>${trimmedLine.substring(2)}</h1>`;
            }
            if (trimmedLine.startsWith('## ')) {
                return `<h2>${trimmedLine.substring(3)}</h2>`;
            }
            if (trimmedLine.startsWith('### ')) {
                return `<h3>${trimmedLine.substring(4)}</h3>`;
            }
            // Quotes: > Quote
            if (trimmedLine.startsWith('&gt; ')) {
                return `<blockquote>${trimmedLine.substring(5)}</blockquote>`;
            }
            // Bullet lists: - item or * item
            if (trimmedLine.startsWith('- ') || trimmedLine.startsWith('* ')) {
                return `<li class="article-list-item">${trimmedLine.substring(2)}</li>`;
            }
            return line;
        });

        formatted = processedLines.join('\n');

        // Newlines to <br>
        formatted = formatted.replace(/\n/g, '<br>');

        return formatted;
    }

    function renderArticleCard(article, isFullView = false) {
        const card = document.createElement('div');
        card.className = 'article-card';
        card.id = `article-${article.id}`;
        
        // Ensure reactions object exists
        if (!article.reactions) article.reactions = {};
        
        const getReactionCount = (emoji) => {
            const data = article.reactions[emoji];
            if (Array.isArray(data)) return data.length;
            return typeof data === 'number' ? data : 0;
        };

        const hasUserReacted = (emoji) => {
            if (!user) return false;
            const data = article.reactions[emoji];
            if (Array.isArray(data)) return data.includes(user.id);
            // Fallback for old data
            const localReactions = GitHubAPI.safeParse(localStorage.getItem(`reactions_${article.id}`)) || [];
            return localReactions.includes(emoji);
        };

        const READ_MORE_LIMIT = 500;
        const isLong = article.content.length > READ_MORE_LIMIT;
        
        let displayContent;
        if (isFullView) {
            displayContent = formatArticleContent(article.content);
        } else if (isLong) {
            // Find a good place to cut (end of a paragraph or sentence near limit)
            let cutIndex = article.content.indexOf('\n', READ_MORE_LIMIT);
            if (cutIndex === -1 || cutIndex > READ_MORE_LIMIT + 100) {
                cutIndex = article.content.indexOf('. ', READ_MORE_LIMIT);
            }
            if (cutIndex === -1 || cutIndex > READ_MORE_LIMIT + 150) {
                cutIndex = READ_MORE_LIMIT;
            }
            displayContent = formatArticleContent(article.content.substring(0, cutIndex)) + '<div class="content-fade"></div>';
        } else {
            displayContent = formatArticleContent(article.content);
        }

        // Slideshow logic for banner (BETA feature)
        const banners = Array.isArray(article.banner) ? article.banner : [article.banner || 'https://placehold.co/400x150'];
        const hasMultipleBanners = banners.length > 1;
        
        let bannerHTML = '';
        if (hasMultipleBanners) {
            bannerHTML = `
                <div class="article-banner slideshow ${hasMultipleBanners ? 'slideshow-active' : ''}" id="slideshow-${article.id}">
                    ${banners.map((b, i) => `
                        <div class="slide ${i === 0 ? 'active' : ''}" style="background-image: ${b.startsWith('#') ? 'none' : `url(${b})`}; background-color: ${b.startsWith('#') ? b : 'transparent'}"></div>
                    `).join('')}
                    <div class="slideshow-nav">
                        <button class="ss-prev">❮</button>
                        <div class="ss-dots">
                            ${banners.map((_, i) => `<span class="ss-dot ${i === 0 ? 'active' : ''}" data-index="${i}"></span>`).join('')}
                        </div>
                        <button class="ss-next">❯</button>
                    </div>
                </div>
            `;
        } else {
            const b = banners[0];
            bannerHTML = `<div class="article-banner" style="background-image: ${b.startsWith('#') ? 'none' : `url(${b})`}; background-color: ${b.startsWith('#') ? b : 'transparent'}"></div>`;
        }

        card.innerHTML = `
            ${bannerHTML}
            <div class="article-info">
                ${(user && String(user.id) === String(article.authorId)) ? `
                    <div class="article-settings-trigger" title="Article Settings" data-article-id="${article.id}">
                        ⚙️
                    </div>
                ` : ''}
                <h3>${article.title} ${article.isPrivate ? '<span class="private-badge" title="Private Article">🔒</span>' : ''}</h3>
                <div class="author-info" data-author-id="${article.authorId}">
                    <img src="${article.authorPfp}" alt="${article.authorName}" class="author-pfp">
                    <span>${window.currentFilter === 'my' ? 'You' : `By ${article.authorName}`}</span>
                </div>
                <div class="timestamp" title="${new Date(article.timestamp).toLocaleString()}">
                    ${new Date(article.timestamp).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
                </div>
                
                <div class="article-content-container">
                    <div class="article-text">${displayContent}</div>
                </div>
                
                <div class="article-footer-actions">
                    <button class="article-action-btn copy-url-btn" data-article-id="${article.id}" title="Copy Article URL">
                        <span class="icon">🔗</span> Copy Link
                    </button>
                    ${(isLong && !isFullView) ? `<button class="read-more-btn" data-article-id="${article.id}">Read More</button>` : ''}
                </div>
                
                <div class="reactions-wrapper">
                    <div class="emoji-picker hidden" id="picker-${article.id}">
                        ${REACTION_EMOJIS.map(emoji => `
                            <button class="picker-emoji" data-emoji="${emoji}" data-article-id="${article.id}">${emoji}</button>
                        `).join('')}
                    </div>
                    <div class="reactions-container">
                        ${Object.entries(article.reactions)
                            .filter(([emoji, data]) => getReactionCount(emoji) > 0)
                            .map(([emoji, data]) => `
                                <button class="reaction-btn ${hasUserReacted(emoji) ? 'active' : ''}" data-emoji="${emoji}" data-article-id="${article.id}">
                                    <span class="emoji">${emoji}</span>
                                    <span class="count">${getReactionCount(emoji)}</span>
                                </button>
                            `).join('')}
                        <button class="reaction-btn add-reaction" data-article-id="${article.id}" title="Add Reaction">+</button>
                        <button class="comment-trigger-btn" data-article-id="${article.id}">
                            <span class="icon">💬</span> Comments ${article.commentCount ? `<span class="comment-count">${article.commentCount}</span>` : ''}
                        </button>
                    </div>
                </div>
            </div>
        `;

        // Click to view banner
        const bannerElement = card.querySelector('.article-banner');
        if (bannerElement) {
            const handleBannerClick = (e) => {
                // Don't trigger if clicking nav buttons or dots
                if (e.target.closest('.slideshow-nav') || e.target.closest('.ss-nav-overlay')) return;
                
                let url = '';
                if (hasMultipleBanners) {
                    const activeSlide = bannerElement.querySelector('.slide.active');
                    if (activeSlide) {
                        const bgImg = activeSlide.style.backgroundImage;
                        if (bgImg && bgImg !== 'none') {
                            url = bgImg.replace(/^url\(["']?/, '').replace(/["']?\)$/, '');
                        }
                    }
                } else {
                    const bgImg = bannerElement.style.backgroundImage;
                    if (bgImg && bgImg !== 'none') {
                        url = bgImg.replace(/^url\(["']?/, '').replace(/["']?\)$/, '');
                    }
                }

                if (url) {
                    openBannerLightbox(url);
                }
            };

            bannerElement.addEventListener('click', handleBannerClick);
            
            // Add visual cue for "Click to View" if it's an image
            if (!hasMultipleBanners) {
                const bgImg = bannerElement.style.backgroundImage;
                if (bgImg && bgImg !== 'none') {
                    const cue = document.createElement('div');
                    cue.className = 'banner-click-cue';
                    cue.innerHTML = '<span>Click to View</span>';
                    bannerElement.appendChild(cue);
                }
            } else {
                // For slideshow, we can add it to the nav overlay or just rely on the slides
                const cue = document.createElement('div');
                cue.className = 'banner-click-cue';
                cue.innerHTML = '<span>Click to View</span>';
                bannerElement.appendChild(cue);
            }
        }

        // Initialize slideshow events if multiple banners (BETA feature)
        if (hasMultipleBanners) {
            let currentIndex = 0;
            const slides = card.querySelectorAll('.slide');
            const dots = card.querySelectorAll('.ss-dot');

            const showSlide = (index) => {
                slides.forEach(s => s.classList.remove('active'));
                dots.forEach(d => d.classList.remove('active'));
                slides[index].classList.add('active');
                dots[index].classList.add('active');
                currentIndex = index;
            };

            card.querySelector('.ss-prev').addEventListener('click', (e) => {
                e.stopPropagation();
                showSlide((currentIndex - 1 + banners.length) % banners.length);
            });

            card.querySelector('.ss-next').addEventListener('click', (e) => {
                e.stopPropagation();
                showSlide((currentIndex + 1) % banners.length);
            });

            dots.forEach(dot => {
                dot.addEventListener('click', (e) => {
                    e.stopPropagation();
                    showSlide(parseInt(dot.dataset.index));
                });
            });

            // Auto-advance slideshow every 5 seconds
            const autoSlide = setInterval(() => {
                if (!document.contains(card)) {
                    clearInterval(autoSlide);
                    return;
                }
                showSlide((currentIndex + 1) % banners.length);
            }, 5000);
        }

        // Settings trigger
        const settingsBtn = card.querySelector('.article-settings-trigger');
        if (settingsBtn) {
            settingsBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                openArticleSettings(article.id);
            });
        }

        card.querySelector('.author-info').addEventListener('click', () => window.showAuthorProfile(article.authorId));
        
        // Comments button
        const commentBtn = card.querySelector('.comment-trigger-btn');
        if (commentBtn) {
            commentBtn.addEventListener('click', () => openComments(article.id, article.title));
        }

        if (isLong && !isFullView) {
            const btn = card.querySelector('.read-more-btn');
            const textContainer = card.querySelector('.article-text');
            btn.addEventListener('click', () => {
                const isExpanded = btn.classList.toggle('expanded');
                if (isExpanded) {
                    textContainer.innerHTML = formatArticleContent(article.content);
                    btn.innerText = 'Read Less';
                } else {
                    // Re-calculate the cut for "Read Less"
                    let cutIndex = article.content.indexOf('\n', READ_MORE_LIMIT);
                    if (cutIndex === -1 || cutIndex > READ_MORE_LIMIT + 100) {
                        cutIndex = article.content.indexOf('. ', READ_MORE_LIMIT);
                    }
                    if (cutIndex === -1 || cutIndex > READ_MORE_LIMIT + 150) {
                        cutIndex = READ_MORE_LIMIT;
                    }
                    textContainer.innerHTML = formatArticleContent(article.content.substring(0, cutIndex)) + '<div class="content-fade"></div>';
                    btn.innerText = 'Read More';
                    // Scroll back to top of card if it's too long
                    card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                }
            });
        }
        // Add reaction button (+) toggles picker
        card.querySelector('.add-reaction').addEventListener('click', (e) => {
            const picker = document.getElementById(`picker-${article.id}`);
            const isHidden = picker.classList.contains('hidden');
            document.querySelectorAll('.emoji-picker').forEach(p => p.classList.add('hidden')); // Close others
            if (isHidden) picker.classList.remove('hidden');
            e.stopPropagation();
        });

        // Picker emoji clicks
        card.querySelectorAll('.picker-emoji').forEach(btn => {
            btn.addEventListener('click', () => {
                handleReaction(article.id, btn.dataset.emoji);
                document.getElementById(`picker-${article.id}`).classList.add('hidden');
            });
        });

        // Existing reaction clicks (to toggle)
        card.querySelectorAll('.reaction-btn:not(.add-reaction)').forEach(btn => {
            btn.addEventListener('click', () => handleReaction(article.id, btn.dataset.emoji));
        });

        // Copy URL event
        const copyBtn = card.querySelector('.copy-url-btn');
        if (copyBtn) {
            copyBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                const articleId = copyBtn.getAttribute('data-article-id');
                // Ensure we get the correct base URL even if running locally or on a different domain
                const baseUrl = window.location.origin + window.location.pathname;
                const url = `${baseUrl}#article-${articleId}`;
                
                navigator.clipboard.writeText(url).then(() => {
                    const originalHTML = copyBtn.innerHTML;
                    copyBtn.innerHTML = '<span class="icon">✅</span> Copied!';
                    copyBtn.classList.add('copied');
                    setTimeout(() => {
                        copyBtn.innerHTML = originalHTML;
                        copyBtn.classList.remove('copied');
                    }, 2000);
                }).catch(err => {
                    console.error('Failed to copy: ', err);
                    alert('Failed to copy URL to clipboard.');
                });
            });
        }

        articlesList.appendChild(card);
        
        // Auto-open comments if requested via hash (optional improvement)
        if (isFullView && window.location.hash.includes('?comments=true')) {
            openComments(article.id, article.title);
        }
    }

    async function handleReaction(articleId, emoji) {
    if (!user) return alert('You must be logged in to react');
    if (user.isGuest) return alert('Guests cannot react to articles. Please log in to join the conversation.');
    
    // Threshold check: Reactions (15 violations)
    if (user.violations >= 15 && String(user.id) !== String(GitHubAPI.DEVELOPER_ID)) {
        alert("You have been restricted from reacting to articles due to multiple rule violations. You can appeal this restriction on the Support page.");
        return;
    }

    // --- OPTIMISTIC UI UPDATE ---
        const container = document.querySelector(`#article-${articleId} .reactions-container`);
        if (!container) return; // Full view check

        const article = articleData[articleId];
        if (!article) return;

        if (!article.reactions) article.reactions = {};
        if (!article.reactions[emoji]) article.reactions[emoji] = [];
        
        const userIndex = article.reactions[emoji].indexOf(user.id);
        const isRemoving = userIndex > -1;

        // Update local state immediately
        if (isRemoving) {
            article.reactions[emoji].splice(userIndex, 1);
        } else {
            article.reactions[emoji].push(user.id);
        }
        
        // Update UI immediately
        updateReactionUI(article);
        // -----------------------------

        try {
            const res = await GitHubAPI.safeUpdateFile(
                `created-articles-storage/${articleId}.json`,
                (content) => {
                    const latestArticle = GitHubAPI.safeParse(content);
                    if (!latestArticle) return content;
                    if (!latestArticle.reactions) latestArticle.reactions = {};
                    if (!latestArticle.reactions[emoji]) latestArticle.reactions[emoji] = [];
                    
                    const latestUserIndex = latestArticle.reactions[emoji].indexOf(user.id);
                    if (isRemoving) {
                        if (latestUserIndex > -1) latestArticle.reactions[emoji].splice(latestUserIndex, 1);
                    } else {
                        if (latestUserIndex === -1) latestArticle.reactions[emoji].push(user.id);
                    }
                    return JSON.stringify(latestArticle);
                },
                `${isRemoving ? 'Remove' : 'Add'} reaction ${emoji}`
            );

            if (res.finalContent) {
                const finalArticle = GitHubAPI.safeParse(res.finalContent);
                if (finalArticle) {
                    articleData[articleId] = finalArticle;
                    articleSHAs[articleId] = res.content.sha;
                    updateReactionUI(finalArticle);

                    if (!isRemoving) {
                        addNotification(finalArticle.authorId, 'reaction', {
                            articleId: finalArticle.id,
                            articleTitle: finalArticle.title
                        });
                    }
                }
            }
        } catch (e) {
            console.error('Background reaction update failed:', e);
            // Roll back UI could be added here if needed
        }
    }

    async function pollReactions() {
        try {
            const files = await GitHubAPI.listFiles('created-articles-storage');
            for (const file of files) {
                // SKIP non-article files like .gitkeep
                if (!file.name.endsWith('.json')) continue;
                
                // If SHA changed, fetch new data
                const articleId = file.name.replace('.json', '');
                if (file.sha !== articleSHAs[articleId]) {
                    const data = await GitHubAPI.getFile(file.path);
                    if (!data || !data.content) continue; // Safety check
                    
                    const article = GitHubAPI.safeParse(data.content);
                    if (!article) continue;
                    
                    // Update state
                    articleSHAs[articleId] = data.sha;
                    articleData[articleId] = article;
                    
                    // Update UI
                    updateReactionUI(article);
                }
            }
        } catch (e) {
            // Silently ignore polling failures to avoid console clutter
        }
    }

    async function syncCommentCount(articleId, count) {
        try {
            const res = await GitHubAPI.safeUpdateFile(
                `created-articles-storage/${articleId}.json`,
                { commentCount: count },
                `Update comment count for article ${articleId}`
            );
            
            if (res.finalContent) {
                const updatedArticle = JSON.parse(res.finalContent);
                articleData[articleId] = updatedArticle;
                articleSHAs[articleId] = res.content.sha;
                updateReactionUI(updatedArticle);
            }
        } catch (e) {
            console.error('Failed to sync comment count:', e);
        }
    }

    function updateReactionUI(article) {
        const card = document.getElementById(`article-${article.id}`);
        if (!card) return;

        const container = card.querySelector('.reactions-container');
        
        const getReactionCount = (emoji) => {
            const data = article.reactions[emoji];
            if (Array.isArray(data)) return data.length;
            return typeof data === 'number' ? data : 0;
        };

        const hasUserReacted = (emoji) => {
            if (!user) return false;
            const data = article.reactions[emoji];
            if (Array.isArray(data)) return data.includes(user.id);
            return false;
        };

        const html = `
            ${Object.entries(article.reactions)
                .filter(([emoji, data]) => getReactionCount(emoji) > 0)
                .map(([emoji, data]) => `
                    <button class="reaction-btn ${hasUserReacted(emoji) ? 'active' : ''}" data-emoji="${emoji}" data-article-id="${article.id}">
                        <span class="emoji">${emoji}</span>
                        <span class="count">${getReactionCount(emoji)}</span>
                    </button>
                `).join('')}
            <button class="reaction-btn add-reaction" data-article-id="${article.id}">+</button>
            <button class="comment-trigger-btn" data-article-id="${article.id}">
                💬 Comments ${article.commentCount ? `<span class="comment-count">(${article.commentCount})</span>` : ''}
            </button>
        `;

        container.innerHTML = html;

        // Re-attach listeners
        container.querySelector('.add-reaction').addEventListener('click', (e) => {
            const picker = document.getElementById(`picker-${article.id}`);
            const isHidden = picker.classList.contains('hidden');
            document.querySelectorAll('.emoji-picker').forEach(p => p.classList.add('hidden'));
            if (isHidden) picker.classList.remove('hidden');
            e.stopPropagation();
        });

        // Add reaction button clicks
        container.querySelectorAll('.reaction-btn:not(.add-reaction)').forEach(btn => {
            btn.addEventListener('click', () => handleReaction(article.id, btn.dataset.emoji));
        });

        // Comments button
        container.querySelector('.comment-trigger-btn').addEventListener('click', () => openComments(article.id, article.title));
    }

    window.showAuthorProfile = async function(authorId) {
        try {
            const data = await GitHubAPI.getFile(`created-news-accounts-storage/${authorId}.json`);
            if (!data) return alert('Author profile not found.');
            const author = GitHubAPI.safeParse(data.content);
            if (!author) return alert('Author profile not found.');

            // Use recorded contributions if available, otherwise calculate
            let authorArticlesCount = author.contributions;
            if (authorArticlesCount === undefined) {
                const allFiles = await GitHubAPI.listFiles('created-articles-storage');
                authorArticlesCount = 0;
                for (const file of allFiles) {
                    if (file.name.endsWith('.json')) {
                        const artData = await GitHubAPI.getFile(file.path);
                        if (artData) {
                            try {
                                const art = GitHubAPI.safeParse(artData.content);
                                if (art && art.authorId === authorId) authorArticlesCount++;
                            } catch(e) {}
                        }
                    }
                }
            }
            
            const joinDateStr = author.joinDate || author.createdAt;
            const joinDate = joinDateStr ? new Date(joinDateStr).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : 'Early Member';

            // Get status info
            const statusIconPath = getStatusIcon({
                status: author.status,
                statusType: author.statusType
            });

            modalContent.innerHTML = `
                <div class="profile-card-header">
                    <div class="profile-card-banner" style="background: ${author.banner.startsWith('#') ? author.banner : `url(${author.banner})`}"></div>
                    <div class="profile-card-pfp-wrapper">
                        <img class="profile-card-pfp" src="${author.pfp}" alt="PFP">
                        <div class="profile-card-status-icon" style="background-image: url('${statusIconPath}')"></div>
                    </div>
                </div>
                <div class="profile-card-body">
                    <div class="profile-card-names">
                        <div class="profile-card-username-row">
                            <span class="profile-card-username">${author.username}</span>
                            ${GitHubAPI.renderRoleBadge(author.role)}
                            ${author.statusMsg ? `<div class="profile-card-status-bubble">${author.statusMsg}</div>` : ''}
                            ${GitHubAPI.renderNewUserBadge(author.joinDate)}
                            ${GitHubAPI.renderThemeBadge()}
                        </div>
                        <span class="profile-card-id">#${author.id}</span>
                    </div>
                    
                    ${author.bio ? `
                        <div class="profile-card-bio">${author.bio}</div>
                    ` : ''}

                    <div class="profile-card-divider"></div>

                    <div class="profile-card-section-title">Contributions</div>
                    <div class="profile-card-stats">
                        <div class="profile-stat">
                            <span class="profile-stat-value">${authorArticlesCount}</span>
                            <span class="profile-stat-label">Articles</span>
                        </div>
                    </div>

                    <div class="profile-card-divider"></div>
                    
                    <div class="profile-card-footer">
                        <div class="profile-join-date">
                            <span class="profile-join-icon">🗓️</span>
                            <span>Joined ${joinDate}</span>
                        </div>
                    </div>
                </div>
            `;
            profileModal.classList.remove('hidden');
        } catch (e) {
            console.error('Error loading profile:', e);
            console.log('GitHubAPI state:', GitHubAPI);
            console.log('GitHubAPI.renderNewUserBadge:', GitHubAPI.renderNewUserBadge);
            alert('Error loading profile: ' + e.message);
        }
    }

    // Close modals
    if (closeModal) closeModal.onclick = () => profileModal.classList.add('hidden');
    if (closeCommentsModal) closeCommentsModal.onclick = () => {
        commentsModal.classList.add('hidden');
        resetCommentInput();
    };

    // Role-based visibility for audio upload
    const checkAudioUploadVisibility = () => {
        const article = articleData[currentArticleIdForComments];
        const isPrivate = article && article.isPrivate;
        const isBeta = user && !user.isGuest && GitHubAPI.isBetaTester(user);

        if (labelAudioUpload) {
            if (isPrivate || isBeta) {
                labelAudioUpload.classList.remove('hidden');
            } else {
                labelAudioUpload.classList.add('hidden');
            }
        }

        if (btnRecordVoice) {
            if (isPrivate || isBeta) {
                btnRecordVoice.classList.remove('hidden');
            } else {
                btnRecordVoice.classList.add('hidden');
            }
        }
    };
    window.onclick = (event) => {
        if (profileModal && event.target == profileModal) profileModal.classList.add('hidden');
        if (commentsModal && event.target == commentsModal) {
            commentsModal.classList.add('hidden');
            resetCommentInput();
        }
    };

    function resetCommentInput() {
        commentInput.value = '';
        currentReplyToId = null;
        currentAttachmentBase64 = null;
        recordedAudioBlob = null;
        if (commentAudioUpload) commentAudioUpload.value = '';
        attachmentPreview.innerHTML = '';
        attachmentPreview.classList.add('hidden');
        if (voiceRecordUI) voiceRecordUI.classList.add('hidden');
        if (mediaRecorder && mediaRecorder.state === 'recording') {
            mediaRecorder.stop();
        }
        if (recordingInterval) clearInterval(recordingInterval);
        const replyInfo = document.querySelector('.replying-to-info');
        if (replyInfo) replyInfo.remove();
    }

    // Attachment handling
    if (commentFileUpload) {
        commentFileUpload.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            // Verify image file type
            if (!file.type.startsWith('image/')) {
                alert('Invalid file type: Please select an image file.');
                commentFileUpload.value = '';
                return;
            }

            try {
                // Re-use optimizeImage if available or simple base64
                const base64 = await fileToBase64(file);
                currentAttachmentBase64 = base64;
                recordedAudioBlob = null; // Clear any audio if image is picked
                if (commentAudioUpload) commentAudioUpload.value = '';
                
                if (attachmentPreview) {
                    attachmentPreview.innerHTML = `
                        <div class="preview-item">
                            <img src="${base64}" alt="Attachment preview">
                            <button class="remove-attachment">&times;</button>
                        </div>
                    `;
                    attachmentPreview.classList.remove('hidden');
                    if (voiceRecordUI) voiceRecordUI.classList.add('hidden');
                    
                    const removeBtn = attachmentPreview.querySelector('.remove-attachment');
                    if (removeBtn) {
                        removeBtn.onclick = () => {
                            currentAttachmentBase64 = null;
                            attachmentPreview.innerHTML = '';
                            attachmentPreview.classList.add('hidden');
                            if (commentFileUpload) commentFileUpload.value = '';
                        };
                    }
                }
            } catch (err) {
                alert('Error loading image');
            }
        });
    }

    if (commentAudioUpload) {
        commentAudioUpload.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;

            // Verify audio file type
            if (!file.type.startsWith('audio/')) {
                alert('Invalid file type: Please select an audio file.');
                commentAudioUpload.value = '';
                return;
            }

            recordedAudioBlob = file;
            currentAttachmentBase64 = null; // Clear any image if audio is picked
            if (commentFileUpload) commentFileUpload.value = '';

            if (attachmentPreview) {
                attachmentPreview.innerHTML = `
                    <div class="preview-item audio-preview">
                        <span class="preview-icon">🎵</span>
                        <span class="preview-filename">${file.name}</span>
                        <button class="remove-attachment">&times;</button>
                    </div>
                `;
                attachmentPreview.classList.remove('hidden');
                if (voiceRecordUI) voiceRecordUI.classList.add('hidden');

                const removeBtn = attachmentPreview.querySelector('.remove-attachment');
                if (removeBtn) {
                    removeBtn.onclick = () => {
                        recordedAudioBlob = null;
                        attachmentPreview.innerHTML = '';
                        attachmentPreview.classList.add('hidden');
                        if (commentAudioUpload) commentAudioUpload.value = '';
                    };
                }
            }
        });
    }

    function fileToBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => resolve(reader.result);
            reader.onerror = error => reject(error);
        });
    }

    // Voice Recording Logic
    if (btnRecordVoice) {
        btnRecordVoice.addEventListener('click', async () => {
            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                return alert('Voice recording is not supported in your browser.');
            }

            try {
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                startRecording(stream);
            } catch (err) {
                console.error('Error accessing microphone:', err);
                alert('Could not access microphone. Please ensure you have given permission.');
            }
        });
    }

    function startRecording(stream) {
        audioChunks = [];
        mediaRecorder = new MediaRecorder(stream);
        
        mediaRecorder.ondataavailable = (event) => {
            audioChunks.push(event.data);
        };

        mediaRecorder.onstop = () => {
            // Verify voice recording type
            const voiceBlob = new Blob(audioChunks, { type: 'audio/webm' });
            if (!voiceBlob.type.startsWith('audio/')) {
                alert('Recording error: Invalid voice data format.');
                recordedAudioBlob = null;
                return;
            }
            recordedAudioBlob = voiceBlob;
            stream.getTracks().forEach(track => track.stop());
            currentAttachmentBase64 = null; // Clear any image if voice is recorded
            if (commentFileUpload) commentFileUpload.value = '';
            if (commentAudioUpload) commentAudioUpload.value = '';
            
            if (attachmentPreview) {
                attachmentPreview.innerHTML = `
                    <div class="preview-item">
                        <span style="font-size: 1.5rem;">🎤</span>
                        <span>Voice Message (${formatDuration(voiceDurationSeconds)})</span>
                        <button class="remove-attachment">&times;</button>
                    </div>
                `;
                attachmentPreview.classList.remove('hidden');
                
                const removeBtn = attachmentPreview.querySelector('.remove-attachment');
                if (removeBtn) {
                    removeBtn.onclick = () => {
                        recordedAudioBlob = null;
                        attachmentPreview.innerHTML = '';
                        attachmentPreview.classList.add('hidden');
                    };
                }
            }
        };

        mediaRecorder.start();
        if (voiceRecordUI) voiceRecordUI.classList.remove('hidden');
        voiceDurationSeconds = 0;
        if (voiceDuration) voiceDuration.innerText = '0:00';
        
        recordingInterval = setInterval(() => {
            voiceDurationSeconds++;
            if (voiceDuration) voiceDuration.innerText = formatDuration(voiceDurationSeconds);
        }, 1000);
    }

    function formatDuration(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }

    if (btnCancelVoice) {
        btnCancelVoice.addEventListener('click', () => {
            if (mediaRecorder && mediaRecorder.state === 'recording') {
                mediaRecorder.stop();
                recordedAudioBlob = null;
            }
            if (voiceRecordUI) voiceRecordUI.classList.add('hidden');
            if (recordingInterval) clearInterval(recordingInterval);
        });
    }

    if (btnStopVoice) {
        btnStopVoice.addEventListener('click', () => {
            if (mediaRecorder && mediaRecorder.state === 'recording') {
                mediaRecorder.stop();
            }
            if (voiceRecordUI) voiceRecordUI.classList.add('hidden');
            if (recordingInterval) clearInterval(recordingInterval);
        });
    }

    async function openComments(articleId, title) {
        currentArticleIdForComments = articleId;
        const modalTitle = document.getElementById('comments-title');
        modalTitle.innerText = `Comments: ${title}`;
        commentsModal.classList.remove('hidden');
        commentsList.innerHTML = '<p class="status-msg">Loading comments...</p>';
        
        checkAudioUploadVisibility();

        try {
            const data = await GitHubAPI.getFile(`article-comments-storage/${articleId}.json`);
            if (data) {
                commentsSHA = data.sha;
                const comments = GitHubAPI.safeParse(data.content);
                if (!comments) {
                    commentsList.innerHTML = '<p class="status-msg">Failed to load comments data.</p>';
                    return;
                }
                modalTitle.innerText = `Comments: ${title} (${comments.length})`;
                // Cache comments for editing
                localStorage.setItem(`comments_${articleId}`, data.content);
                renderComments(comments);

                // Sync count if it's missing or different in articleData
                const article = articleData[articleId];
                if (article && article.commentCount !== comments.length) {
                    syncCommentCount(articleId, comments.length);
                }
            } else {
                commentsSHA = null;
                commentsList.innerHTML = '<p class="status-msg">No comments yet. Be the first to say something!</p>';
                
                // Sync count if it's not 0 in articleData
                const article = articleData[articleId];
                if (article && article.commentCount !== 0) {
                    syncCommentCount(articleId, 0);
                }
            }
        } catch (e) {
            commentsSHA = null;
            commentsList.innerHTML = '<p class="status-msg">No comments yet. Be the first to say something!</p>';
            
            // Sync count if it's not 0 in articleData (error usually means file doesn't exist)
            const article = articleData[articleId];
            if (article && article.commentCount !== 0) {
                syncCommentCount(articleId, 0);
            }
        }
    }

    function formatCommentText(text) {
        if (!text) return '';
        
        // Escape HTML
        let formatted = text
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");

        // User Mentions: @username or @[user name]
        // Handle @[user name] first
        formatted = formatted.replace(/@\[(.*?)\]/g, (match, username) => {
            return `<span class="mention" onclick="findAndShowUser('${username.replace(/'/g, "\\'")}')">@${username}</span>`;
        });
        // Handle @username (no spaces)
        formatted = formatted.replace(/@([a-zA-Z0-9_]+)/g, '<span class="mention" onclick="findAndShowUser(\'$1\')">@$1</span>');

        // Link Embedding (YouTube/Images)
        if (GitHubAPI.embedLinks) {
            formatted = GitHubAPI.embedLinks(formatted);
        }

        return formatted.replace(/\n/g, '<br>');
    }

    window.findAndShowUser = async function(username) {
        // This is a bit expensive, but we need to find the ID by username
        try {
            const files = await GitHubAPI.listFiles('created-news-accounts-storage');
            for (const file of files) {
                if (!file.name.endsWith('.json')) continue;
                // Use getFileRaw for speed since we don't need a SHA for searching
                const content = await GitHubAPI.getFileRaw(file.path);
                if (!content) continue;
                const account = GitHubAPI.safeParse(content);
                if (account && account.username.toLowerCase() === username.toLowerCase()) {
                    window.showAuthorProfile(account.id);
                    return;
                }
            }
            alert('User not found');
        } catch (e) {
            console.error(e);
        }
    };

    function renderComments(comments) {
        if (!comments || comments.length === 0) {
            commentsList.innerHTML = '<p class="status-msg">No comments yet. Be the first to say something!</p>';
            return;
        }

        const article = articleData[currentArticleIdForComments];
        const isArticleAuthor = user && article && String(article.authorId) === String(user.id);
        const canManageArticle = isArticleAuthor;

        // Separate pinned and unpinned, and organize into threads
        const pinnedComments = comments.filter(c => c.pinned).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        
        // Root comments (no replyToId OR its parent doesn't exist anymore)
        const commentIds = new Set(comments.map(c => c.id));
        const unpinnedRootComments = comments.filter(c => !c.pinned && (!c.replyToId || !commentIds.has(c.replyToId)))
            .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        
        const getReplies = (commentId) => comments.filter(c => c.replyToId === commentId).sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

        const renderCommentHtml = (c, depth = 0) => {
            const replies = depth < 5 ? getReplies(c.id) : []; // Limit depth to 5 for UI sanity
            const upvotes = (c.votes && c.votes.up) ? c.votes.up.length : 0;
            const downvotes = (c.votes && c.votes.down) ? c.votes.down.length : 0;
            const userUpvoted = user && c.votes && c.votes.up && c.votes.up.map(id => String(id)).includes(String(user.id));
            const userDownvoted = user && c.votes && c.votes.down && c.votes.down.map(id => String(id)).includes(String(user.id));
            const isCommentOwner = user && String(c.authorId) === String(user.id);

            return `
                <div class="comment-thread" style="${depth > 0 ? 'margin-left: 20px; border-left: 2px solid var(--border-color); padding-left: 10px;' : ''}">
                    <div class="comment-item ${c.pinned ? 'pinned' : ''}" id="comment-${c.id}">
                        ${c.pinned ? '<div class="pinned-badge">📌 Pinned by author</div>' : ''}
                        <div class="comment-header">
                            <div class="comment-pfp-wrapper">
                                <img src="${c.authorPfp}" alt="${c.authorName}" class="comment-pfp" onclick="window.showAuthorProfile('${c.authorId}')">
                                <div class="comment-status-icon" data-user-id="${c.authorId}"></div>
                            </div>
                            <div class="comment-author-info">
                                <div class="comment-author-row" data-user-id="${c.authorId}">
                                    <span class="comment-author-name" onclick="window.showAuthorProfile('${c.authorId}')">${c.authorName}</span>
                                    ${GitHubAPI.renderRoleBadge(c.authorRole)}
                                    ${GitHubAPI.renderNewUserBadge(c.authorJoinDate, 'user-badge comment-badge')}
                                    ${GitHubAPI.renderThemeBadge('user-badge comment-badge')}
                                    <div class="comment-status-bubble" data-user-id="${c.authorId}" style="display: none;"></div>
                                </div>
                                <span class="comment-timestamp">${new Date(c.timestamp).toLocaleString()}</span>
                            </div>
                        </div>
                        <div class="comment-body">
                            ${formatCommentText(c.text)}
                            ${c.edited ? `<span class="comment-edited-tag" title="Last edited: ${new Date(c.lastEdited).toLocaleString()}">(edited)</span>` : ''}
                            ${c.audioUrl ? `
                                <div class="voice-message-container" data-audio-url="${c.audioUrl}">
                                    <div class="custom-audio-player">
                                        <button class="audio-play-btn" onclick="window.toggleAudioPlay(this)">
                                            <i class="fas fa-play"></i>
                                        </button>
                                        <div class="audio-waveform-container" onclick="window.seekAudio(event, this)">
                                            <div class="audio-progress-bar">
                                                <div class="audio-progress-fill"></div>
                                            </div>
                                        </div>
                                        <span class="audio-time">0:00</span>
                                        <audio src="${c.audioUrl}" preload="metadata" ontimeupdate="window.updateAudioProgress(this)" onended="window.resetAudioPlayer(this)" onloadedmetadata="window.initAudioDuration(this)"></audio>
                                    </div>
                                </div>
                            ` : ''}
                            ${c.attachment ? `
                                <div class="comment-attachment">
                                    <img src="${c.attachment}" alt="Attachment" onclick="window.open('${c.attachment}', '_blank')">
                                </div>
                            ` : ''}
                        </div>
                        <div class="comment-actions">
                            <div class="comment-votes">
                                <button class="vote-btn upvote ${userUpvoted ? 'upvoted' : ''}" onclick="window.handleCommentVote('${c.id}', 'up')">
                                    ▲ <span class="vote-count">${upvotes}</span>
                                </button>
                                <button class="vote-btn downvote ${userDownvoted ? 'downvoted' : ''}" onclick="window.handleCommentVote('${c.id}', 'down')">
                                    ▼ <span class="vote-count">${downvotes}</span>
                                </button>
                            </div>
                            <span class="action-link" onclick="window.setupReply('${c.id}', '${c.authorName}')">Reply</span>
                            ${canManageArticle ? `
                                <span class="action-link pin-btn ${c.pinned ? 'active' : ''}" onclick="window.togglePinComment('${c.id}')">
                                    ${c.pinned ? 'Unpin' : 'Pin'}
                                </span>
                            ` : ''}
                            ${(canManageArticle || isCommentOwner) ? `
                                <span class="action-link delete-comment-btn" onclick="window.handleDeleteComment('${c.id}')">Delete</span>
                            ` : ''}
                            ${isCommentOwner ? `
                                <span class="action-link edit-comment-btn" onclick="window.setupEditComment('${c.id}')">Edit</span>
                            ` : ''}
                        </div>
                    </div>
                    ${replies.length > 0 ? `
                        <div class="replies-container">
                            ${replies.map(r => renderCommentHtml(r, depth + 1)).join('')}
                        </div>
                    ` : ''}
                </div>
            `;
        };

        commentsList.innerHTML = [
            ...pinnedComments.map(c => renderCommentHtml(c)),
            ...unpinnedRootComments.map(c => renderCommentHtml(c))
        ].join('');

        // Update statuses asynchronously
        updateCommentStatuses(comments);
    }

    async function updateCommentStatuses(comments) {
        const authorIds = [...new Set(comments.map(c => c.authorId))];
        
        for (const authorId of authorIds) {
            const statusInfo = await fetchUserStatus(authorId);
            const iconUrl = getStatusIcon(statusInfo);
            
            // Update icons
            document.querySelectorAll(`.comment-status-icon[data-user-id="${authorId}"]`).forEach(el => {
                el.style.backgroundImage = `url('${iconUrl}')`;
            });
            
            // Update bubbles
            document.querySelectorAll(`.comment-status-bubble[data-user-id="${authorId}"]`).forEach(el => {
                if (statusInfo.statusMsg) {
                    el.innerText = statusInfo.statusMsg;
                    el.style.display = 'block';
                } else {
                    el.style.display = 'none';
                }
            });

            // Update badges (for legacy comments that don't have authorJoinDate)
            if (statusInfo.joinDate) {
                document.querySelectorAll(`.comment-author-row[data-user-id="${authorId}"]`).forEach(row => {
                    // Only add if not already present or if we want to ensure it's up to date
                    const nameEl = row.querySelector('.comment-author-name');
                    if (nameEl) {
                        const roleBadge = GitHubAPI.renderRoleBadge(statusInfo.role);
                        const newUserBadge = GitHubAPI.renderNewUserBadge(statusInfo.joinDate, 'user-badge comment-badge');
                        const themeBadge = GitHubAPI.renderThemeBadge('user-badge comment-badge');
                        
                        // Clear existing and re-add
                        row.querySelectorAll('.badge-wrapper').forEach(b => b.remove());
                        nameEl.insertAdjacentHTML('afterend', roleBadge + newUserBadge + themeBadge);
                    }
                });
            }
        }
    }

    window.setupReply = function(commentId, authorName) {
        if (!user) return alert('You must be logged in to reply');
        if (user.isGuest) return alert('Guests cannot reply to comments. Please log in to join the conversation.');
        currentReplyToId = commentId;
        
        // Show visual indicator
        const existingInfo = document.querySelector('.replying-to-info');
        if (existingInfo) existingInfo.remove();
        
        const info = document.createElement('div');
        info.className = 'replying-to-info';
        info.innerHTML = `
            <span>Replying to <strong>@${authorName}</strong></span>
            <span class="cancel-reply" onclick="cancelReply()">Cancel</span>
        `;
        
        commentInput.parentNode.insertBefore(info, commentInput);
        commentInput.focus();
        
        // Auto-mention the user
        if (!commentInput.value.includes(`@${authorName}`)) {
            commentInput.value = `@${authorName} ` + commentInput.value;
        }
    };

    window.handleDeleteComment = async function(commentId) {
         if (!user || user.isGuest || !currentArticleIdForComments) return;
         if (!confirm('Are you sure you want to delete this comment?')) return;

         // --- OPTIMISTIC UPDATE ---
         const cachedComments = JSON.parse(localStorage.getItem(`comments_${currentArticleIdForComments}`) || '[]');
         const originalComments = JSON.parse(JSON.stringify(cachedComments)); // Backup
         
         const commentToDelete = cachedComments.find(c => String(c.id) === String(commentId));
         if (!commentToDelete) return;

         const article = articleData[currentArticleIdForComments];
         const isArticleAuthor = user && article && String(article.authorId) === String(user.id);
         const canManageArticle = isArticleAuthor;
         const isCommentOwner = user && String(commentToDelete.authorId) === String(user.id);
 
         if (!canManageArticle && !isCommentOwner) {
             alert('You do not have permission to delete this comment.');
             return;
         }

         // Filter out the comment and its descendants immediately
         const getDescendantIdsLocal = (parentId, allComments) => {
             const children = allComments.filter(c => String(c.replyToId) === String(parentId));
             let ids = children.map(c => String(c.id));
             for (const child of children) {
                 ids = [...ids, ...getDescendantIdsLocal(child.id, allComments)];
             }
             return ids;
         };

         const allIdsToDeleteLocal = [String(commentId), ...getDescendantIdsLocal(commentId, cachedComments)];
         const optimisticallyUpdated = cachedComments.filter(c => !allIdsToDeleteLocal.includes(String(c.id)));
         localStorage.setItem(`comments_${currentArticleIdForComments}`, JSON.stringify(optimisticallyUpdated));
         renderComments(optimisticallyUpdated);

        try {
            const res = await GitHubAPI.safeUpdateFile(
                `article-comments-storage/${currentArticleIdForComments}.json`,
                (content) => {
                    if (!content) return "";
                    let comments = JSON.parse(content);
                    const index = comments.findIndex(c => String(c.id) === String(commentId));
                    if (index === -1) return content;
                    
                    const remoteCommentToDelete = comments[index];
                    const isArticleAuthorRemote = user && article && String(article.authorId) === String(user.id);
                    const canManageArticleRemote = isArticleAuthorRemote;
                    const isCommentOwnerRemote = user && String(remoteCommentToDelete.authorId) === String(user.id);

                    if (!canManageArticleRemote && !isCommentOwnerRemote) {
                        throw new Error('You do not have permission to delete this comment.');
                    }

                    // Remove the comment and all its descendants (recursive delete)
                    const getDescendantIds = (parentId, allComments) => {
                        const children = allComments.filter(c => String(c.replyToId) === String(parentId));
                        let ids = children.map(c => String(c.id));
                        for (const child of children) {
                            ids = [...ids, ...getDescendantIds(child.id, allComments)];
                        }
                        return ids;
                    };

                    const descendantIds = getDescendantIds(commentId, comments);
                    const allIdsToDelete = [String(commentId), ...descendantIds];
                    
                    const commentsToDelete = comments.filter(c => allIdsToDelete.includes(String(c.id)));
                    
                    // Handle audio deletions from Supabase
                    commentsToDelete.forEach(c => {
                        if (c.audioUrl) {
                            GitHubAPI.deleteAudio(c.audioUrl);
                        }
                    });

                    const updatedComments = comments.filter(c => !allIdsToDelete.includes(String(c.id)));
                    return JSON.stringify(updatedComments);
                },
                `Delete comment ${commentId}`
            );
            
            if (res.finalContent) {
                const finalComments = JSON.parse(res.finalContent);
                localStorage.setItem(`comments_${currentArticleIdForComments}`, JSON.stringify(finalComments));
                renderComments(finalComments);
                
                // Update article comment count
                syncCommentCount(currentArticleIdForComments, finalComments.length);
            }
        } catch (e) {
            console.error('Delete comment failed:', e);
            alert('Failed to delete comment: ' + e.message);
            // Rollback optimistic delete
            localStorage.setItem(`comments_${currentArticleIdForComments}`, JSON.stringify(originalComments));
            renderComments(originalComments);
        }
    };

     window.cancelReply = function() {
          currentReplyToId = null;
          const info = document.querySelector('.replying-to-info');
          if (info) info.remove();
      };

    // --- Custom Audio Player Logic ---
    window.toggleAudioPlay = function(btn) {
        const container = btn.closest('.custom-audio-player');
        const audio = container.querySelector('audio');
        const icon = btn.querySelector('i');

        // Stop all other playing audios first
        document.querySelectorAll('audio').forEach(a => {
            if (a !== audio && !a.paused) {
                a.pause();
                const otherBtn = a.closest('.custom-audio-player').querySelector('.audio-play-btn i');
                if (otherBtn) otherBtn.className = 'fas fa-play';
            }
        });

        if (audio.paused) {
            audio.play().catch(e => console.error('Audio play failed:', e));
            icon.className = 'fas fa-pause';
        } else {
            audio.pause();
            icon.className = 'fas fa-play';
        }
    };

    window.updateAudioProgress = function(audio) {
        const container = audio.closest('.custom-audio-player');
        const fill = container.querySelector('.audio-progress-fill');
        const timeDisplay = container.querySelector('.audio-time');
        
        if (audio.duration && !isNaN(audio.duration)) {
            const percent = (audio.currentTime / audio.duration) * 100;
            fill.style.width = `${percent}%`;
            timeDisplay.innerText = formatDuration(Math.floor(audio.currentTime));
        }
    };

    window.resetAudioPlayer = function(audio) {
        const container = audio.closest('.custom-audio-player');
        const icon = container.querySelector('.audio-play-btn i');
        const fill = container.querySelector('.audio-progress-fill');
        const timeDisplay = container.querySelector('.audio-time');
        
        if (icon) icon.className = 'fas fa-play';
        fill.style.width = '0%';
        timeDisplay.innerText = formatDuration(Math.floor(audio.duration || 0));
        audio.currentTime = 0;
    };

    window.initAudioDuration = function(audio) {
        const container = audio.closest('.custom-audio-player');
        const timeDisplay = container.querySelector('.audio-time');
        if (audio.duration && !isNaN(audio.duration)) {
            timeDisplay.innerText = formatDuration(Math.floor(audio.duration));
        }
    };

    window.seekAudio = function(e, container) {
        const audio = container.closest('.custom-audio-player').querySelector('audio');
        const rect = container.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const width = rect.width;
        const percent = x / width;
        
        if (audio.duration && !isNaN(audio.duration)) {
            audio.currentTime = percent * audio.duration;
        }
    };


    window.togglePinComment = async function(commentId) {
        if (!currentArticleIdForComments || !user) return;
        
        const article = articleData[currentArticleIdForComments];
        if (!article || String(article.authorId) !== String(user.id)) return;

        // --- OPTIMISTIC UPDATE ---
        const cachedComments = JSON.parse(localStorage.getItem(`comments_${currentArticleIdForComments}`) || '[]');
        const originalComments = JSON.parse(JSON.stringify(cachedComments)); // Backup
        
        const commentToPin = cachedComments.find(c => String(c.id) === String(commentId));
        if (commentToPin) {
            const isCurrentlyPinned = commentToPin.pinned;
            if (!isCurrentlyPinned) {
                cachedComments.forEach(c => c.pinned = false);
            }
            commentToPin.pinned = !isCurrentlyPinned;
            
            // Apply immediate UI change
            localStorage.setItem(`comments_${currentArticleIdForComments}`, JSON.stringify(cachedComments));
            renderComments(cachedComments);
        }

        try {
            const res = await GitHubAPI.safeUpdateFile(
                `article-comments-storage/${currentArticleIdForComments}.json`,
                (content) => {
                    if (!content) return "";
                    let comments = JSON.parse(content);
                    const comment = comments.find(c => String(c.id) === String(commentId));
                    if (!comment) return content;
                    
                    const isCurrentlyPinned = comment.pinned;
                    if (!isCurrentlyPinned) {
                        comments.forEach(c => c.pinned = false);
                    }
                    comment.pinned = !isCurrentlyPinned;
                    return JSON.stringify(comments);
                },
                `Toggle pin on comment ${commentId}`
            );
            
            if (res.finalContent) {
                const finalComments = JSON.parse(res.finalContent);
                localStorage.setItem(`comments_${currentArticleIdForComments}`, JSON.stringify(finalComments));
                
                const pinnedComment = finalComments.find(c => String(c.id) === String(commentId));
                if (pinnedComment && pinnedComment.pinned) {
                    const article = articleData[currentArticleIdForComments];
                    addNotification(pinnedComment.authorId, 'pin', {
                        articleId: article.id,
                        articleTitle: article.title,
                        commentId: pinnedComment.id
                    });
                }
                renderComments(finalComments);
            }
        } catch (e) {
            console.error('Pin failed:', e);
            // Revert on failure
            localStorage.setItem(`comments_${currentArticleIdForComments}`, JSON.stringify(originalComments));
            renderComments(originalComments);
            alert('Failed to pin comment: ' + e.message);
        }
    };

    let currentEditingCommentId = null;

    window.setupEditComment = function(commentId) {
        if (!user || user.isGuest) return;
        const commentEl = document.getElementById(`comment-${commentId}`);
        if (!commentEl) return;

        const bodyEl = commentEl.querySelector('.comment-body');
        if (!bodyEl) return;

        // If already editing this one, do nothing
        if (currentEditingCommentId === commentId) return;
        
        // If editing another one, cancel it first? 
        // For simplicity, just allow multiple or handle one at a time.
        // Let's do one at a time.
        if (currentEditingCommentId) {
            const prevEdit = document.getElementById(`comment-${currentEditingCommentId}`);
            if (prevEdit) {
                const cachedComments = JSON.parse(localStorage.getItem(`comments_${currentArticleIdForComments}`) || '[]');
                renderComments(cachedComments); // Re-render all to reset
            }
        }

        currentEditingCommentId = commentId;

        // Find the comment data from the passed comments array if possible, or localStorage
        let comment = null;
        if (typeof comments !== 'undefined' && Array.isArray(comments)) {
            comment = comments.find(c => c.id === commentId);
        }
        
        if (!comment) {
            const cachedComments = JSON.parse(localStorage.getItem(`comments_${currentArticleIdForComments}`) || '[]');
            comment = cachedComments.find(c => c.id === commentId);
        }

        if (!comment) return;

        const originalText = comment.text;
        
        bodyEl.innerHTML = `
            <div class="edit-comment-container">
                <textarea class="edit-comment-input">${originalText}</textarea>
                <div class="edit-comment-actions">
                    <button class="save-edit-btn">Save</button>
                    <button class="cancel-edit-btn">Cancel</button>
                </div>
            </div>
        `;

        const textarea = bodyEl.querySelector('.edit-comment-input');
        const saveBtn = bodyEl.querySelector('.save-edit-btn');
        const cancelBtn = bodyEl.querySelector('.cancel-edit-btn');

        textarea.focus();

        cancelBtn.onclick = () => {
            currentEditingCommentId = null;
            const cachedComments = JSON.parse(localStorage.getItem(`comments_${currentArticleIdForComments}`) || '[]');
            renderComments(cachedComments);
        };

        saveBtn.onclick = async () => {
            const newText = textarea.value.trim();
            if (!newText && !comment.attachment && !comment.audioUrl) return alert('Comment cannot be empty');
            if (newText === originalText) {
                currentEditingCommentId = null;
                const cachedComments = JSON.parse(localStorage.getItem(`comments_${currentArticleIdForComments}`) || '[]');
                renderComments(cachedComments);
                return;
            }

            // Check for rule violations
            const ruleCheck = await GitHubAPI.checkContentForRules(newText);
            if (!ruleCheck.isClean) {
                GitHubAPI.showRulesWarningModal(ruleCheck.violatedWords, '../');
                return;
            }

            saveBtn.disabled = true;
            saveBtn.innerText = 'Saving...';

            // --- OPTIMISTIC UPDATE ---
            const cachedComments = JSON.parse(localStorage.getItem(`comments_${currentArticleIdForComments}`) || '[]');
            const originalComments = JSON.parse(JSON.stringify(cachedComments)); // Backup for revert
            
            const commentToUpdate = cachedComments.find(x => x.id === commentId);
            if (commentToUpdate) {
                commentToUpdate.text = newText;
                commentToUpdate.edited = true;
                commentToUpdate.lastEdited = new Date().toISOString();
                
                // Show update immediately in UI
                localStorage.setItem(`comments_${currentArticleIdForComments}`, JSON.stringify(cachedComments));
                renderComments(cachedComments);
                currentEditingCommentId = null;
            }

            try {
                const res = await GitHubAPI.safeUpdateFile(
                    `article-comments-storage/${currentArticleIdForComments}.json`,
                    (content) => {
                        if (!content) return "";
                        let comments = JSON.parse(content);
                        const c = comments.find(x => x.id === commentId);
                        if (c) {
                            c.text = newText;
                            c.edited = true;
                            c.lastEdited = new Date().toISOString();
                        }
                        return JSON.stringify(comments);
                    },
                    `Edit comment ${commentId}`
                );

                if (res.finalContent) {
                    const finalComments = JSON.parse(res.finalContent);
                    localStorage.setItem(`comments_${currentArticleIdForComments}`, JSON.stringify(finalComments));
                    renderComments(finalComments);
                }
            } catch (e) {
                console.error('Failed to save edit:', e);
                alert('Failed to save edit: ' + e.message);
                
                // --- REVERT OPTIMISTIC UPDATE ---
                localStorage.setItem(`comments_${currentArticleIdForComments}`, JSON.stringify(originalComments));
                renderComments(originalComments);
                
                saveBtn.disabled = false;
                saveBtn.innerText = 'Save';
            }
        };
    };

    window.handleCommentVote = async function(commentId, type) {
        if (!user) return alert('You must be logged in to vote');
        if (user.isGuest) return alert('Guests cannot vote on comments. Please log in to join the conversation.');
        
        // --- OPTIMISTIC UPDATE ---
        const cachedCommentsStr = localStorage.getItem(`comments_${currentArticleIdForComments}`);
        if (!cachedCommentsStr) return; // Should not happen if UI is showing comments

        const cachedComments = JSON.parse(cachedCommentsStr);
        const originalComments = JSON.parse(JSON.stringify(cachedComments)); // Backup
        
        // Use loose comparison or string conversion for IDs
        const commentToVote = cachedComments.find(c => String(c.id) === String(commentId));
        if (commentToVote) {
            if (!commentToVote.votes) commentToVote.votes = { up: [], down: [] };
            if (!commentToVote.votes.up) commentToVote.votes.up = [];
            if (!commentToVote.votes.down) commentToVote.votes.down = [];

            // Ensure all IDs in the arrays are strings for comparison
            const userIdStr = String(user.id);
            const upIndex = commentToVote.votes.up.map(id => String(id)).indexOf(userIdStr);
            const downIndex = commentToVote.votes.down.map(id => String(id)).indexOf(userIdStr);

            if (type === 'up') {
                if (upIndex > -1) {
                    commentToVote.votes.up.splice(upIndex, 1);
                } else {
                    commentToVote.votes.up.push(userIdStr);
                    if (downIndex > -1) commentToVote.votes.down.splice(downIndex, 1);
                }
            } else if (type === 'down') {
                if (downIndex > -1) {
                    commentToVote.votes.down.splice(downIndex, 1);
                } else {
                    commentToVote.votes.down.push(userIdStr);
                    if (upIndex > -1) commentToVote.votes.up.splice(upIndex, 1);
                }
            }
            
            // Apply immediate UI change
            try {
                localStorage.setItem(`comments_${currentArticleIdForComments}`, JSON.stringify(cachedComments));
                renderComments(cachedComments);
            } catch (renderError) {
                console.error('Optimistic render failed:', renderError);
            }
        }

        try {
            const res = await GitHubAPI.safeUpdateFile(
                `article-comments-storage/${currentArticleIdForComments}.json`,
                (content) => {
                    if (!content) return "";
                    let comments = JSON.parse(content);
                    const comment = comments.find(c => String(c.id) === String(commentId));
                    if (!comment) return content;
                    
                    if (!comment.votes) comment.votes = { up: [], down: [] };
                    if (!comment.votes.up) comment.votes.up = [];
                    if (!comment.votes.down) comment.votes.down = [];

                    const userIdStr = String(user.id);
                    const upIndex = comment.votes.up.map(id => String(id)).indexOf(userIdStr);
                    const downIndex = comment.votes.down.map(id => String(id)).indexOf(userIdStr);

                    if (type === 'up') {
                        if (upIndex > -1) {
                            comment.votes.up.splice(upIndex, 1);
                        } else {
                            comment.votes.up.push(userIdStr);
                            if (downIndex > -1) comment.votes.down.splice(downIndex, 1);
                        }
                    } else if (type === 'down') {
                        if (downIndex > -1) {
                            comment.votes.down.splice(downIndex, 1);
                        } else {
                            comment.votes.down.push(userIdStr);
                            if (upIndex > -1) comment.votes.up.splice(upIndex, 1);
                        }
                    }
                    return JSON.stringify(comments);
                },
                `Vote ${type} on comment ${commentId}`
            );
            
            if (res.finalContent) {
                const finalComments = JSON.parse(res.finalContent);
                localStorage.setItem(`comments_${currentArticleIdForComments}`, JSON.stringify(finalComments));
                renderComments(finalComments);
            }
        } catch (e) {
            console.error('Vote failed:', e);
            // Revert on failure
            localStorage.setItem(`comments_${currentArticleIdForComments}`, JSON.stringify(originalComments));
            renderComments(originalComments);
        }
    };

    if (btnSubmitComment) {
        btnSubmitComment.addEventListener('click', async () => {
            if (!commentInput) return;
            const text = commentInput.value.trim();
            if (!text && !currentAttachmentBase64 && !recordedAudioBlob) return;
            if (!user) return alert('You must be logged in to comment');
            if (user.isGuest) return alert('Guests cannot post comments. Please log in to join the conversation.');

            // Threshold check: Comments (10 violations)
            if (user.violations >= 10 && String(user.id) !== String(GitHubAPI.DEVELOPER_ID)) {
                alert("You have been restricted from commenting due to multiple rule violations. You can appeal this restriction on the Support page.");
                return;
            }

            // Check if user is muted on this article
            const article = articleData[currentArticleIdForComments];
            if (article && article.mutes && article.mutes[user.id]) {
                const expiry = article.mutes[user.id];
                if (expiry === 'permanent') {
                    return alert('You have been permanently muted from commenting on this article.');
                } else {
                    const expiryTime = parseInt(expiry);
                    if (expiryTime > Date.now()) {
                        return alert(`You are muted from commenting on this article until ${new Date(expiryTime).toLocaleString()}.`);
                    }
                }
            }

            // Check for rule violations
            const ruleCheck = await GitHubAPI.checkContentForRules(text);
            if (!ruleCheck.isClean) {
                GitHubAPI.showRulesWarningModal(ruleCheck.violatedWords, '../');
                return;
            }

            // Handle audio upload if present
            let audioUrl = null;
            if (recordedAudioBlob) {
                try {
                    btnSubmitComment.disabled = true;
                    btnSubmitComment.innerText = 'Uploading Audio...';
                    
                    // Private articles can bypass Beta Tester restriction for voice/audio
                    const isPrivate = article && article.isPrivate;
                    if (!isPrivate && (!user || user.isGuest || !GitHubAPI.isBetaTester(user))) {
                        throw new Error('You do not have permission to upload audio to public articles.');
                    }
                    
                    audioUrl = await GitHubAPI.uploadAudio(recordedAudioBlob);
                } catch (err) {
                    console.error('Audio upload failed:', err);
                    alert('Failed to upload voice message. Please try again.');
                    btnSubmitComment.disabled = false;
                    btnSubmitComment.innerText = 'Post';
                    return;
                }
            }

            // --- OPTIMISTIC UI PREP ---
            const newComment = {
                id: GitHubAPI.generateID().toString(),
                authorId: user.id,
                authorName: user.username,
                authorPfp: user.pfp,
                authorJoinDate: user.joinDate,
                text: text,
                timestamp: new Date().toISOString(),
                replyToId: currentReplyToId,
                rootCommentId: null, // Will be set below
                attachment: currentAttachmentBase64,
                audioUrl: audioUrl,
                pinned: false,
                votes: { up: [], down: [] }
            };

            // Set rootCommentId
            if (!currentReplyToId) {
                newComment.rootCommentId = newComment.id;
            } else {
                // Find parent to get its root
                const cachedComments = JSON.parse(localStorage.getItem(`comments_${currentArticleIdForComments}`) || '[]');
                const parent = cachedComments.find(c => c.id === currentReplyToId);
                newComment.rootCommentId = parent ? (parent.rootCommentId || parent.id) : currentReplyToId;
            }

            const savedText = text;
            const savedAttachment = currentAttachmentBase64;
            const savedAudioBlob = recordedAudioBlob;
            const savedReplyToId = currentReplyToId;

            // Clear input immediately for snappiness
            resetCommentInput();
            btnSubmitComment.disabled = true;
            btnSubmitComment.innerText = 'Posting...';

        // Use safeUpdateFile to handle persistence with atomicity and queuing
        try {
            const res = await GitHubAPI.safeUpdateFile(
                `article-comments-storage/${currentArticleIdForComments}.json`,
                (content) => {
                    let remoteComments = [];
                    try {
                        if (content) remoteComments = JSON.parse(content);
                    } catch (e) {}
                    
                    remoteComments.push(newComment);
                    return JSON.stringify(remoteComments);
                },
                `New comment on article ${currentArticleIdForComments}`
            );

            if (res.finalContent) {
                const finalComments = JSON.parse(res.finalContent);
                commentsSHA = res.content ? res.content.sha : commentsSHA;
                renderComments(finalComments);

                // Update article comment count
                syncCommentCount(currentArticleIdForComments, finalComments.length);

                // Send notifications in background
                const currentArticle = articleData[currentArticleIdForComments];
                if (currentArticle) {
                    // 1. Notify article author
                    addNotification(currentArticle.authorId, 'comment', {
                        articleId: currentArticle.id,
                        articleTitle: currentArticle.title,
                        commentId: newComment.id
                    });

                    // 2. Notify replied user
                    if (savedReplyToId) {
                        const parentComment = finalComments.find(c => c.id === savedReplyToId);
                        if (parentComment) {
                            addNotification(parentComment.authorId, 'reply', {
                                articleId: currentArticle.id,
                                articleTitle: currentArticle.title,
                                commentId: newComment.id
                            });
                        }
                    }

                    // 3. Notify mentioned users
                    const mentionsWithSpaces = savedText.match(/@\[(.*?)\]/g) || [];
                    const mentionsSimple = savedText.match(/@([a-zA-Z0-9_]+)/g) || [];
                    
                    const allMentions = [
                        ...mentionsWithSpaces.map(m => m.substring(2, m.length - 1)),
                        ...mentionsSimple.map(m => m.substring(1))
                    ];

                    if (allMentions.length > 0) {
                        const uniqueMentions = [...new Set(allMentions)];
                        for (const username of uniqueMentions) {
                            (async () => {
                                try {
                                    const files = await GitHubAPI.listFiles('created-news-accounts-storage');
                                    for (const file of files) {
                                        if (!file.name.endsWith('.json')) continue;
                                        const accData = await GitHubAPI.getFile(file.path);
                                        if (!accData || !accData.content) continue;
                                        const account = GitHubAPI.safeParse(accData.content);
                                        if (account && account.username.toLowerCase() === username.toLowerCase()) {
                                            addNotification(account.id, 'mention', {
                                                articleId: currentArticle.id,
                                                articleTitle: currentArticle.title,
                                                commentId: newComment.id
                                            });
                                            break;
                                        }
                                    }
                                } catch (e) {
                                    // Silent fail for background mention lookup
                                }
                            })();
                        }
                    }
                }
            }
        } catch (e) {
            console.error('Comment submission failed:', e);
            let alertMsg = 'Failed to post comment. Your text has been restored.';
            if (e.status === 403 || e.status === 429) {
                alertMsg = 'You are being rate limited by GitHub. Please wait a moment before trying again.';
            } else if (e.status === 409) {
                alertMsg = 'Conflict detected. Someone else might be commenting. Retrying...';
            }
            alert(alertMsg);
            commentInput.value = savedText;
            // Re-setup attachment if it existed
            if (savedAttachment) {
                currentAttachmentBase64 = savedAttachment;
                attachmentPreview.innerHTML = `
                    <div class="preview-item">
                        <img src="${savedAttachment}" alt="Attachment preview">
                        <button class="remove-attachment">&times;</button>
                    </div>
                `;
                attachmentPreview.classList.remove('hidden');
                attachmentPreview.querySelector('.remove-attachment').onclick = () => {
                    currentAttachmentBase64 = null;
                    attachmentPreview.innerHTML = '';
                    attachmentPreview.classList.add('hidden');
                    commentFileUpload.value = '';
                };
            } else if (savedAudioBlob) {
                recordedAudioBlob = savedAudioBlob;
                attachmentPreview.innerHTML = `
                    <div class="preview-item">
                        <span style="font-size: 1.5rem;">🎤</span>
                        <span>Voice Message</span>
                        <button class="remove-attachment">&times;</button>
                    </div>
                `;
                attachmentPreview.classList.remove('hidden');
                attachmentPreview.querySelector('.remove-attachment').onclick = () => {
                    recordedAudioBlob = null;
                    attachmentPreview.innerHTML = '';
                    attachmentPreview.classList.add('hidden');
                };
            }
        } finally {
            btnSubmitComment.disabled = false;
            btnSubmitComment.innerText = 'Post';
        }
    });
}
});
