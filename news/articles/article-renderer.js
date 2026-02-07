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
        const statusInfo = {
            status: u.status || 'offline',
            statusType: u.statusType || 'auto',
            statusMsg: u.statusMsg || ''
        };
        const iconPath = getStatusIcon(statusInfo);

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
    };

    let user = JSON.parse(localStorage.getItem('current_user'));
    let userSHA = null;

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

    if (user) {
        const loggedInDiv = document.getElementById('logged-in-user');
        loggedInDiv.classList.remove('hidden');
        updateSideProfileWithStatus(user);
        pollUserProfile(); // Initial fetch
        pollNotifications(); // Initial notifications fetch
        checkIP(); // Initial IP check
    }

    async function addNotification(targetUserId, type, data) {
        if (!targetUserId || (user && targetUserId === user.id)) return; // Don't notify self

        try {
            await GitHubAPI.safeUpdateFile(
                `news/notifications-storage/${targetUserId}.json`,
                (content) => {
                    let remoteNotifications = [];
                    try {
                        if (content) remoteNotifications = JSON.parse(content);
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
            const data = await GitHubAPI.getFile(`news/created-news-accounts-storage/${userId}.json`);
            if (data) {
                const userData = JSON.parse(data.content);
                userStatusCache[userId] = {
                    status: userData.status || 'offline',
                    statusType: userData.statusType || 'auto',
                    statusMsg: userData.statusMsg || '',
                    joinDate: userData.joinDate || null
                };
                return userStatusCache[userId];
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
            // Probably doesn't exist yet
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

        // Optimistic UI
        n.read = true;
        updateNotificationUI();
        
        try {
            await GitHubAPI.safeUpdateFile(
                `news/notifications-storage/${user.id}.json`,
                (content) => {
                    if (!content) return JSON.stringify(notifications);
                    const remoteNotifs = JSON.parse(content);
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
        await GitHubAPI.syncUserProfile((remoteUser) => {
            // Update local user reference properties
            Object.assign(user, remoteUser);
            
            // Update sidebar UI
            updateSideProfileWithStatus(remoteUser);
            
            console.log('Profile updated from remote');
        });
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
                singleArticleHeader.classList.remove('hidden');
                exploreTitle.classList.add('hidden');
                
                const data = await GitHubAPI.getFile(`news/created-articles-storage/${singleArticleId}.json`);
                if (!data) {
                    articlesList.innerHTML = '<p class="status-msg">Article not found.</p>';
                    return;
                }
                
                const article = JSON.parse(data.content);
                articleSHAs[article.id] = data.sha;
                articleData[article.id] = article;
                articlesList.innerHTML = '';
                renderArticleCard(article, true); // true for full view
            } else {
                // Feed view
                document.body.classList.remove('single-article-view');
                singleArticleHeader.classList.add('hidden');
                exploreTitle.classList.remove('hidden');
                
                const files = await GitHubAPI.listFiles('news/created-articles-storage');
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
                        const article = JSON.parse(data.content);
                        article.sha = data.sha;
                        console.log(`Successfully loaded article: ${article.title} (${article.id})`);
                        return article;
                    } catch (e) { 
                        console.error(`Failed to parse article JSON for ${file.path}:`, e);
                        return null; 
                    }
                }));

                const validArticles = articles.filter(a => a !== null);
                console.log(`Total valid articles: ${validArticles.length}`);

                const filteredArticles = validArticles
                    .filter(a => !a.isPrivate || (user && user.id === a.authorId)) // Filter out private articles unless author
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
                window.notificationPollingInterval = setInterval(pollNotifications, 20000); // Check notifications every 20s
                window.ipPollingInterval = setInterval(checkIP, 60000); // Check IP every 60s
            }
        } catch (e) {
            articlesList.innerHTML = `<p>Error loading articles: ${e.message}. Make sure you have set your PAT in the Dashboard.</p>`;
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
                            const data = await GitHubAPI.getFile(`news/article-comments-storage/${article.id}.json`);
                            const count = data ? JSON.parse(data.content).length : 0;
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
    });

    // Article Management Modal
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

    // Tab Logic
    const sidebarTabs = document.querySelectorAll('.sidebar-tab');
    const tabPanes = document.querySelectorAll('.tab-pane');

    sidebarTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const targetTab = tab.getAttribute('data-tab');
            
            // Update tabs
            sidebarTabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');

            // Update panes
            tabPanes.forEach(pane => {
                pane.classList.remove('active');
                if (pane.id === `tab-${targetTab}`) {
                    pane.classList.add('active');
                }
            });
        });
    });

    let currentEditingArticleId = null;
    let currentEditingBannerBase64 = null;

    async function openArticleSettings(articleId) {
        currentEditingArticleId = articleId;
        const article = articleData[articleId];
        if (!article) return;

        // Reset to first tab
        sidebarTabs[0].click();

        editTitle.value = article.title;
        editContent.value = article.content;
        editBannerPreview.src = article.banner || 'https://via.placeholder.com/400x150';
        markPrivateToggle.checked = !!article.isPrivate;
        currentEditingBannerBase64 = article.banner;

        renderMutedUsers(article.mutes || {});

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

    window.handleUnmute = async function(userId) {
        if (!currentEditingArticleId || !user) return;
        
        const article = articleData[currentEditingArticleId];
        if (!article || article.authorId !== user.id) return;

        if (article.mutes && article.mutes[userId]) {
            const oldMutes = { ...article.mutes };
            delete article.mutes[userId];
            renderMutedUsers(article.mutes);

            try {
                await GitHubAPI.safeUpdateFile(
                    `news/created-articles-storage/${currentEditingArticleId}.json`,
                    (content) => {
                        const data = JSON.parse(content);
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

    btnMuteUser.addEventListener('click', async () => {
        const userId = muteUserIdInput.value.trim();
        if (!userId || !currentEditingArticleId || !user) return;
        
        const article = articleData[currentEditingArticleId];
        if (!article || article.authorId !== user.id) return;

        const duration = muteDurationSelect.value;
        const expiry = duration === 'permanent' ? 'permanent' : (Date.now() + parseInt(duration) * 1000).toString();
        
        const oldMutes = { ...(article.mutes || {}) };
        if (!article.mutes) article.mutes = {};
        article.mutes[userId] = expiry;
        
        muteUserIdInput.value = '';
        renderMutedUsers(article.mutes);

        btnMuteUser.disabled = true;
        btnMuteUser.innerText = 'Muting...';

        try {
            await GitHubAPI.safeUpdateFile(
                `news/created-articles-storage/${currentEditingArticleId}.json`,
                (content) => {
                    const data = JSON.parse(content);
                    if (!data.mutes) data.mutes = {};
                    data.mutes[userId] = expiry;
                    return JSON.stringify(data);
                },
                `Mute user ${userId} on article ${currentEditingArticleId}`
            );
        } catch (e) {
            console.error('Failed to mute on GitHub:', e);
            article.mutes = oldMutes; // Revert on failure
            renderMutedUsers(article.mutes);
            alert('Failed to save mute: ' + e.message);
        } finally {
            btnMuteUser.disabled = false;
            btnMuteUser.innerText = 'Mute';
        }
    });

    closeSettingsModal.addEventListener('click', () => {
        settingsModal.classList.add('hidden');
        currentEditingArticleId = null;
        currentEditingBannerBase64 = null;
    });

    editBannerUpload.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            currentEditingBannerBase64 = event.target.result;
            editBannerPreview.src = currentEditingBannerBase64;
        };
        reader.readAsDataURL(file);
    });

    btnSaveSettings.addEventListener('click', async () => {
        if (!currentEditingArticleId || !user) return;

        // Extra safety check
        const localArticle = articleData[currentEditingArticleId];
        if (!localArticle || localArticle.authorId !== user.id) {
            return alert('You do not have permission to edit this article.');
        }

        btnSaveSettings.disabled = true;
        btnSaveSettings.innerText = 'Saving...';

        try {
            // Get latest UI state for mutes
            const currentMutes = localArticle.mutes || {};

            const res = await GitHubAPI.safeUpdateFile(
                `news/created-articles-storage/${currentEditingArticleId}.json`,
                (content) => {
                    if (!content) throw new Error("Article file not found");
                    const currentArticle = JSON.parse(content);
                    
                    const updatedArticle = {
                        ...currentArticle,
                        title: editTitle.value.trim(),
                        content: editContent.value.trim(),
                        banner: currentEditingBannerBase64,
                        isPrivate: markPrivateToggle.checked,
                        // Use the mutes from our local state which includes any recent changes in the UI
                        mutes: currentMutes,
                        lastUpdated: new Date().toISOString()
                    };

                    if (!updatedArticle.title || !updatedArticle.content) {
                        throw new Error('Title and content are required.');
                    }

                    return JSON.stringify(updatedArticle);
                },
                `Update article: ${editTitle.value.trim()}`
            );
            
            if (res.finalContent) {
                const finalArticle = JSON.parse(res.finalContent);
                
                // Update local state
                articleData[currentEditingArticleId] = finalArticle;
                articleSHAs[currentEditingArticleId] = res.content.sha;
                
                // Reload or update UI
                settingsModal.classList.add('hidden');
                loadArticles(); // Refresh to show changes
                alert('Article updated successfully!');
            }
        } catch (e) {
            console.error('Failed to update article:', e);
            alert('Failed to save changes: ' + e.message);
        } finally {
            btnSaveSettings.disabled = false;
            btnSaveSettings.innerText = 'Save Changes';
        }
    });

    btnDeleteArticle.addEventListener('click', async () => {
        if (!currentEditingArticleId || !user) return;

        // Extra safety check
        const localArticle = articleData[currentEditingArticleId];
        if (!localArticle || localArticle.authorId !== user.id) {
            return alert('You do not have permission to delete this article.');
        }

        if (!confirm('Are you absolutely sure you want to delete this article? This action cannot be undone.')) {
            return;
        }

        btnDeleteArticle.disabled = true;
        btnDeleteArticle.innerText = 'Deleting...';

        try {
            // 1. Fetch latest SHA to ensure we can delete without conflict
            const latest = await GitHubAPI.getFile(`news/created-articles-storage/${currentEditingArticleId}.json`);
            if (!latest) throw new Error('Could not find article to delete.');
            
            const currentSha = latest.sha;

            // 2. Delete article file
            await GitHubAPI.request(`/contents/news/created-articles-storage/${currentEditingArticleId}.json`, 'DELETE', {
                message: `Delete article: ${currentEditingArticleId}`,
                sha: currentSha
            });

            // 3. Optionally delete comments file
            try {
                const commentsRes = await GitHubAPI.getFile(`news/article-comments-storage/${currentEditingArticleId}.json`);
                if (commentsRes) {
                    await GitHubAPI.request(`/contents/news/article-comments-storage/${currentEditingArticleId}.json`, 'DELETE', {
                        message: `Delete comments for article: ${currentEditingArticleId}`,
                        sha: commentsRes.sha
                    });
                }
            } catch (e) {
                console.warn('Comments file deletion skipped or failed:', e);
            }

            // 4. Update user contributions count
            try {
                const userData = await GitHubAPI.getFile(`news/created-news-accounts-storage/${user.id}.json`);
                if (userData) {
                    const profile = JSON.parse(userData.content);
                    profile.contributions = Math.max(0, (profile.contributions || 1) - 1);
                    await GitHubAPI.updateFile(
                        `news/created-news-accounts-storage/${user.id}.json`,
                        JSON.stringify(profile),
                        `Decrement contributions for ${user.username}`,
                        userData.sha
                    );
                    localStorage.setItem('current_user', JSON.stringify(profile));
                }
            } catch (e) {
                console.warn('Failed to update contributions count:', e);
            }

            // 5. Cleanup local state
            delete articleData[currentEditingArticleId];
            delete articleSHAs[currentEditingArticleId];
            
            // 6. UI Update
            settingsModal.classList.add('hidden');
            
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
            btnDeleteArticle.disabled = false;
            btnDeleteArticle.innerText = 'Delete Article';
        }
    });
 
     // Listen for hash changes to switch between single and feed view
     window.addEventListener('hashchange', loadArticles);
 
     // Back to feed button
    btnBackToFeed.addEventListener('click', () => {
        window.location.hash = '';
    });

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
            const localReactions = JSON.parse(localStorage.getItem(`reactions_${article.id}`) || '[]');
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

        // Slideshow logic for banner
        const banners = Array.isArray(article.banner) ? article.banner : [article.banner || 'https://via.placeholder.com/400x150'];
        let bannerHTML = '';
        if (banners.length > 1) {
            bannerHTML = `
                <div class="article-banner slideshow" id="slideshow-${article.id}">
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
                ${(user && user.id === article.authorId) ? `
                    <div class="article-settings-trigger" title="Article Settings" data-article-id="${article.id}">
                        ⚙️
                    </div>
                ` : ''}
                <h3>${article.title}</h3>
                <div class="author-info" data-author-id="${article.authorId}">
                    <img src="${article.authorPfp}" alt="${article.authorName}" class="author-pfp">
                    <span>By ${article.authorName}</span>
                </div>
                <p class="timestamp">${new Date(article.timestamp).toLocaleDateString()}</p>
                
                <div class="article-content-container">
                    <div class="article-text">${displayContent}</div>
                </div>
                
                <div class="article-footer-actions">
                    <button class="article-action-btn copy-url-btn" data-article-id="${article.id}" title="Copy Article URL">
                        🔗 Copy Link
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
                        <button class="reaction-btn add-reaction" data-article-id="${article.id}">+</button>
                        <button class="comment-trigger-btn" data-article-id="${article.id}">
                            💬 Comments ${article.commentCount ? `<span class="comment-count">(${article.commentCount})</span>` : ''}
                        </button>
                    </div>
                </div>
            </div>
        `;

        // Click to view banner
        const bannerElement = card.querySelector('.article-banner');
        if (bannerElement) {
            if (banners.length > 1) {
                // Slideshow case: add click to each slide
                const slides = card.querySelectorAll('.slide');
                slides.forEach(slide => {
                    slide.addEventListener('click', (e) => {
                        // Don't trigger if clicking nav buttons
                        if (e.target.closest('.slideshow-nav')) return;
                        
                        const bgImg = slide.style.backgroundImage;
                        if (bgImg && bgImg !== 'none') {
                            const url = bgImg.slice(5, -2);
                            openBannerLightbox(url);
                        }
                    });
                });
            } else {
                // Single banner case
                bannerElement.addEventListener('click', () => {
                    const bgImg = bannerElement.style.backgroundImage;
                    if (bgImg && bgImg !== 'none') {
                        const url = bgImg.slice(5, -2);
                        openBannerLightbox(url);
                    }
                });
            }
        }

        // Initialize slideshow events if multiple banners
        if (banners.length > 1) {
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
                    const originalText = copyBtn.innerHTML;
                    copyBtn.innerHTML = '✅ Copied!';
                    copyBtn.classList.add('copied');
                    setTimeout(() => {
                        copyBtn.innerHTML = originalText;
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
                `news/created-articles-storage/${articleId}.json`,
                (content) => {
                    const latestArticle = JSON.parse(content);
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
                const finalArticle = JSON.parse(res.finalContent);
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
        } catch (e) {
            console.error('Background reaction update failed:', e);
            // Roll back UI could be added here if needed
        }
    }

    async function pollReactions() {
        try {
            const files = await GitHubAPI.listFiles('news/created-articles-storage');
            for (const file of files) {
                // SKIP non-article files like .gitkeep
                if (!file.name.endsWith('.json')) continue;
                
                // If SHA changed, fetch new data
                const articleId = file.name.replace('.json', '');
                if (file.sha !== articleSHAs[articleId]) {
                    const data = await GitHubAPI.getFile(file.path);
                    if (!data || !data.content) continue; // Safety check
                    
                    const article = JSON.parse(data.content);
                    
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
                `news/created-articles-storage/${articleId}.json`,
                (content) => {
                    if (!content) return "";
                    const article = JSON.parse(content);
                    article.commentCount = count;
                    return JSON.stringify(article);
                },
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
            const data = await GitHubAPI.getFile(`news/created-news-accounts-storage/${authorId}.json`);
            if (!data) return alert('Author profile not found.');
            const author = JSON.parse(data.content);

            // Use recorded contributions if available, otherwise calculate
            let authorArticlesCount = author.contributions;
            if (authorArticlesCount === undefined) {
                const allFiles = await GitHubAPI.listFiles('news/created-articles-storage');
                authorArticlesCount = 0;
                for (const file of allFiles) {
                    if (file.name.endsWith('.json')) {
                        const artData = await GitHubAPI.getFile(file.path);
                        if (artData) {
                            try {
                                const art = JSON.parse(artData.content);
                                if (art.authorId === authorId) authorArticlesCount++;
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
                            ${author.role === 'admin' ? '<span class="admin-badge">Admin</span>' : ''}
                            ${author.statusMsg ? `<div class="profile-card-status-bubble">${author.statusMsg}</div>` : ''}
                            ${GitHubAPI.renderNewUserBadge(author.joinDate)}
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
        attachmentPreview.innerHTML = '';
        attachmentPreview.classList.add('hidden');
        const replyInfo = document.querySelector('.replying-to-info');
        if (replyInfo) replyInfo.remove();
    }

    // Attachment handling
    commentFileUpload.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        try {
            // Re-use optimizeImage if available or simple base64
            const base64 = await fileToBase64(file);
            currentAttachmentBase64 = base64;
            
            attachmentPreview.innerHTML = `
                <div class="preview-item">
                    <img src="${base64}" alt="Attachment preview">
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
        } catch (err) {
            alert('Error loading image');
        }
    });

    function fileToBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => resolve(reader.result);
            reader.onerror = error => reject(error);
        });
    }

    async function openComments(articleId, title) {
        currentArticleIdForComments = articleId;
        const modalTitle = document.getElementById('comments-title');
        modalTitle.innerText = `Comments: ${title}`;
        commentsModal.classList.remove('hidden');
        commentsList.innerHTML = '<p class="status-msg">Loading comments...</p>';
        
        try {
            const data = await GitHubAPI.getFile(`news/article-comments-storage/${articleId}.json`);
            if (data) {
                commentsSHA = data.sha;
                const comments = JSON.parse(data.content);
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

        return formatted.replace(/\n/g, '<br>');
    }

    window.findAndShowUser = async function(username) {
        // This is a bit expensive, but we need to find the ID by username
        try {
            const files = await GitHubAPI.listFiles('news/created-news-accounts-storage');
            for (const file of files) {
                if (!file.name.endsWith('.json')) continue;
                // Use getFileRaw for speed since we don't need a SHA for searching
                const content = await GitHubAPI.getFileRaw(file.path);
                if (!content) continue;
                const account = JSON.parse(content);
                if (account.username.toLowerCase() === username.toLowerCase()) {
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
        const isArticleAuthor = user && article && article.authorId === user.id;

        // Separate pinned and unpinned, and organize into threads
        const pinnedComments = comments.filter(c => c.pinned).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        const unpinnedComments = comments.filter(c => !c.pinned && !c.replyToId).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        
        const getReplies = (commentId) => comments.filter(c => c.replyToId === commentId).sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

        const renderCommentHtml = (c, isReply = false) => {
            const replies = !isReply ? getReplies(c.id) : [];
            const upvotes = (c.votes && c.votes.up) ? c.votes.up.length : 0;
            const downvotes = (c.votes && c.votes.down) ? c.votes.down.length : 0;
            const userUpvoted = user && c.votes && c.votes.up && c.votes.up.map(id => String(id)).includes(String(user.id));
            const userDownvoted = user && c.votes && c.votes.down && c.votes.down.map(id => String(id)).includes(String(user.id));
            const isCommentOwner = user && String(c.authorId) === String(user.id);

            return `
                <div class="comment-thread">
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
                                    ${GitHubAPI.renderNewUserBadge(c.authorJoinDate, 'user-badge comment-badge')}
                                    <div class="comment-status-bubble" data-user-id="${c.authorId}" style="display: none;"></div>
                                </div>
                                <span class="comment-timestamp">${new Date(c.timestamp).toLocaleString()}</span>
                            </div>
                        </div>
                        <div class="comment-body">
                            ${formatCommentText(c.text)}
                            ${c.edited ? `<span class="comment-edited-tag" title="Last edited: ${new Date(c.lastEdited).toLocaleString()}">(edited)</span>` : ''}
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
                            ${isArticleAuthor ? `
                                <span class="action-link pin-btn ${c.pinned ? 'active' : ''}" onclick="window.togglePinComment('${c.id}')">
                                    ${c.pinned ? 'Unpin' : 'Pin'}
                                </span>
                            ` : ''}
                            ${(isArticleAuthor || isCommentOwner) ? `
                                <span class="action-link delete-comment-btn" onclick="window.handleDeleteComment('${c.id}')">Delete</span>
                            ` : ''}
                            ${isCommentOwner ? `
                                <span class="action-link edit-comment-btn" onclick="window.setupEditComment('${c.id}')">Edit</span>
                            ` : ''}
                        </div>
                    </div>
                    ${replies.length > 0 ? `
                        <div class="replies-container">
                            ${replies.map(r => renderCommentHtml(r, true)).join('')}
                        </div>
                    ` : ''}
                </div>
            `;
        };

        commentsList.innerHTML = [
            ...pinnedComments.map(c => renderCommentHtml(c)),
            ...unpinnedComments.map(c => renderCommentHtml(c))
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
                    const existingBadge = row.querySelector('.user-badge');
                    if (!existingBadge) {
                        const badgeHtml = GitHubAPI.renderNewUserBadge(statusInfo.joinDate, 'user-badge comment-badge');
                        if (badgeHtml) {
                            const nameEl = row.querySelector('.comment-author-name');
                            if (nameEl) {
                                nameEl.insertAdjacentHTML('afterend', badgeHtml);
                            }
                        }
                    }
                });
            }
        }
    }

    window.setupReply = function(commentId, authorName) {
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
         if (!user || !currentArticleIdForComments) return;
         if (!confirm('Are you sure you want to delete this comment?')) return;

         // --- OPTIMISTIC UPDATE ---
         const cachedComments = JSON.parse(localStorage.getItem(`comments_${currentArticleIdForComments}`) || '[]');
         const originalComments = JSON.parse(JSON.stringify(cachedComments)); // Backup
         
         const commentToDelete = cachedComments.find(c => String(c.id) === String(commentId));
         if (!commentToDelete) return;

         const article = articleData[currentArticleIdForComments];
         const isArticleAuthor = user && article && String(article.authorId) === String(user.id);
         const isCommentOwner = user && String(commentToDelete.authorId) === String(user.id);

         if (!isArticleAuthor && !isCommentOwner) {
             alert('You do not have permission to delete this comment.');
             return;
         }

         // Filter out the comment and its replies immediately
         const optimisticallyUpdated = cachedComments.filter(c => String(c.id) !== String(commentId) && String(c.replyToId) !== String(commentId));
         localStorage.setItem(`comments_${currentArticleIdForComments}`, JSON.stringify(optimisticallyUpdated));
         renderComments(optimisticallyUpdated);

        try {
            const res = await GitHubAPI.safeUpdateFile(
                `news/article-comments-storage/${currentArticleIdForComments}.json`,
                (content) => {
                    if (!content) return "";
                    let comments = JSON.parse(content);
                    const index = comments.findIndex(c => String(c.id) === String(commentId));
                    if (index === -1) return content;
                    
                    const remoteCommentToDelete = comments[index];
                    const isArticleAuthorRemote = user && article && String(article.authorId) === String(user.id);
                    const isCommentOwnerRemote = user && String(remoteCommentToDelete.authorId) === String(user.id);

                    if (!isArticleAuthorRemote && !isCommentOwnerRemote) {
                        throw new Error('You do not have permission to delete this comment.');
                    }

                    // Remove the comment and all its replies
                    const updatedComments = comments.filter(c => String(c.id) !== String(commentId) && String(c.replyToId) !== String(commentId));
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

    window.togglePinComment = async function(commentId) {
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
                `news/article-comments-storage/${currentArticleIdForComments}.json`,
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
            if (!newText && !comment.attachment) return alert('Comment cannot be empty');
            if (newText === originalText) {
                currentEditingCommentId = null;
                const cachedComments = JSON.parse(localStorage.getItem(`comments_${currentArticleIdForComments}`) || '[]');
                renderComments(cachedComments);
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
                    `news/article-comments-storage/${currentArticleIdForComments}.json`,
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
                `news/article-comments-storage/${currentArticleIdForComments}.json`,
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

    btnSubmitComment.addEventListener('click', async () => {
        const text = commentInput.value.trim();
        if (!text && !currentAttachmentBase64) return;
        if (!user) return alert('You must be logged in to comment');

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
            attachment: currentAttachmentBase64,
            pinned: false,
            votes: { up: [], down: [] }
        };

        const savedText = text;
        const savedAttachment = currentAttachmentBase64;
        const savedReplyToId = currentReplyToId;

        // Clear input immediately for snappiness
        resetCommentInput();
        btnSubmitComment.disabled = true;
        btnSubmitComment.innerText = 'Posting...';

        // Use safeUpdateFile to handle persistence with atomicity and queuing
        try {
            const res = await GitHubAPI.safeUpdateFile(
                `news/article-comments-storage/${currentArticleIdForComments}.json`,
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
                                    const files = await GitHubAPI.listFiles('news/created-news-accounts-storage');
                                    for (const file of files) {
                                        if (!file.name.endsWith('.json')) continue;
                                        const accData = await GitHubAPI.getFile(file.path);
                                        if (!accData || !accData.content) continue;
                                        const account = JSON.parse(accData.content);
                                        if (account.username.toLowerCase() === username.toLowerCase()) {
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
            }
        } finally {
            btnSubmitComment.disabled = false;
            btnSubmitComment.innerText = 'Post';
        }
    });
});
