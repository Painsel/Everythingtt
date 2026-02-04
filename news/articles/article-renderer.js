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
    
    let currentArticleIdForComments = null;
    let commentsSHA = null;
    let currentReplyToId = null;
    let currentAttachmentBase64 = null;
    let notifications = [];
    let notificationsSHA = null;

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

    if (user) {
        const loggedInDiv = document.getElementById('logged-in-user');
        loggedInDiv.classList.remove('hidden');
        updateSideProfileWithStatus(user);
        pollUserProfile(); // Initial fetch
        pollNotifications(); // Initial notifications fetch
    }

    async function addNotification(targetUserId, type, data) {
        if (!targetUserId || (user && targetUserId === user.id)) return; // Don't notify self

        try {
            let remoteNotifications = [];
            let sha = null;
            try {
                const res = await GitHubAPI.getFile(`news/notifications-storage/${targetUserId}.json`);
                if (res) {
                    remoteNotifications = JSON.parse(res.content);
                    sha = res.sha;
                }
            } catch (e) {}

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
            if (remoteNotifications.length > 200) remoteNotifications = remoteNotifications.slice(0, 200); // Limit to 200

            await GitHubAPI.updateFile(
                `news/notifications-storage/${targetUserId}.json`,
                JSON.stringify(remoteNotifications),
                `New notification for ${targetUserId}`,
                sha
            );
        } catch (e) {
            console.error('Failed to send notification:', e);
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
                    statusMsg: userData.statusMsg || ''
                };
                return userStatusCache[userId];
            }
        } catch (e) {
            console.warn(`Could not fetch status for user ${userId}`);
        }
        return { status: 'offline', statusType: 'auto', statusMsg: '' };
    }

    function getStatusIcon(statusInfo) {
        const type = statusInfo.statusType;
        const status = statusInfo.status;
        
        let icon = 'Offline.png';
        if (type === 'dnd') {
            icon = 'DoNotDisturb.png';
        } else if (status === 'online') {
            icon = 'Online.png';
        } else if (status === 'idle') {
            icon = 'Idle.png';
        }
        
        return `../../User Status Icons/${icon}`;
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
        try {
            const data = await GitHubAPI.getFile(`news/created-news-accounts-storage/${user.id}.json`);
            if (data && data.sha !== userSHA) {
                userSHA = data.sha;
                const remoteUser = JSON.parse(data.content);
                
                // Update localStorage and UI if changed
                const localUser = JSON.parse(localStorage.getItem('current_user'));
                if (JSON.stringify(remoteUser) !== JSON.stringify(localUser)) {
                    localStorage.setItem('current_user', JSON.stringify(remoteUser));
                    
                    // Update sidebar UI
                    updateSideProfileWithStatus(remoteUser);
                    
                    // Update local user reference properties
                    Object.assign(user, remoteUser);
                    console.log('Profile updated from remote');
                }
            }
        } catch (e) {
            console.error('Profile polling failed:', e);
        }
    }

    // Load articles
    async function loadArticles() {
        const hash = window.location.hash;
        const singleArticleId = hash.startsWith('#article-') ? hash.replace('#article-', '') : null;
        
        try {
            articlesList.innerHTML = '<p class="status-msg">Loading articles...</p>';
            
            if (singleArticleId) {
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
                
                if (!files || files.length === 0) {
                    articlesList.innerHTML = '<p class="status-msg">No articles found. Be the first to publish!</p>';
                    return;
                }

                articlesList.innerHTML = ''; // Clear loading message
                // Sort by timestamp descending
                const articleFiles = files.filter(f => f.type === 'file' && f.name.endsWith('.json'));
                
                // Fetch all articles
                const articles = await Promise.all(articleFiles.map(async (file) => {
                    const data = await GitHubAPI.getFile(file.path);
                    if (!data) return null;
                    try {
                        const article = JSON.parse(data.content);
                        article.sha = data.sha;
                        return article;
                    } catch (e) { return null; }
                }));

                const validArticles = articles.filter(a => a !== null)
                    .filter(a => !a.isPrivate || (user && user.id === a.authorId)) // Filter out private articles unless author
                    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
                
                for (const article of validArticles) {
                    articleSHAs[article.id] = article.sha;
                    articleData[article.id] = article;
                    renderArticleCard(article, false);
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
            }
        } catch (e) {
            articlesList.innerHTML = `<p>Error loading articles: ${e.message}. Make sure you have set your PAT in the Dashboard.</p>`;
        }
    }

    // Initial load
    loadArticles();

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

    window.handleUnmute = function(userId) {
        if (!currentEditingArticleId) return;
        const article = articleData[currentEditingArticleId];
        if (article.mutes && article.mutes[userId]) {
            delete article.mutes[userId];
            renderMutedUsers(article.mutes);
        }
    };

    btnMuteUser.addEventListener('click', () => {
        const userId = muteUserIdInput.value.trim();
        if (!userId) return;
        
        const duration = muteDurationSelect.value;
        const expiry = duration === 'permanent' ? 'permanent' : (Date.now() + parseInt(duration) * 1000).toString();
        
        if (!currentEditingArticleId) return;
        const article = articleData[currentEditingArticleId];
        if (!article.mutes) article.mutes = {};
        
        article.mutes[userId] = expiry;
        muteUserIdInput.value = '';
        renderMutedUsers(article.mutes);
    });

    closeSettingsModal.addEventListener('click', () => {
        settingsModal.classList.add('hidden');
        currentEditingArticleId = null;
        currentEditingBannerBase64 = null;
    });

    editBannerUpload.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        if (file.size > 2 * 1024 * 1024) { // 2MB limit
            alert('Image is too large. Max 2MB.');
            return;
        }

        const reader = new FileReader();
        reader.onload = (event) => {
            currentEditingBannerBase64 = event.target.result;
            editBannerPreview.src = currentEditingBannerBase64;
        };
        reader.readAsDataURL(file);
    });

    btnSaveSettings.addEventListener('click', async () => {
        if (!currentEditingArticleId || !user) return;

        const article = articleData[currentEditingArticleId];
        const sha = articleSHAs[currentEditingArticleId];
        
        const updatedArticle = {
            ...article,
            title: editTitle.value.trim(),
            content: editContent.value.trim(),
            banner: currentEditingBannerBase64,
            isPrivate: markPrivateToggle.checked,
            mutes: article.mutes || {},
            lastUpdated: new Date().toISOString()
        };

        if (!updatedArticle.title || !updatedArticle.content) {
            alert('Title and content are required.');
            return;
        }

        btnSaveSettings.disabled = true;
        btnSaveSettings.innerText = 'Saving...';

        try {
            await GitHubAPI.updateFile(
                `news/created-articles-storage/${currentEditingArticleId}.json`,
                JSON.stringify(updatedArticle),
                `Update article: ${updatedArticle.title}`,
                sha
            );
            
            // Update local state
            articleData[currentEditingArticleId] = updatedArticle;
            
            // Reload or update UI
            settingsModal.classList.add('hidden');
            loadArticles(); // Refresh to show changes
            alert('Article updated successfully!');
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

        if (!confirm('Are you absolutely sure you want to delete this article? This action cannot be undone.')) {
            return;
        }

        const sha = articleSHAs[currentEditingArticleId];
        btnDeleteArticle.disabled = true;
        btnDeleteArticle.innerText = 'Deleting...';

        try {
            // Delete article file
            await GitHubAPI.request(`/contents/news/created-articles-storage/${currentEditingArticleId}.json`, 'DELETE', {
                message: `Delete article: ${currentEditingArticleId}`,
                sha: sha
            });

            // Optionally delete comments file
            try {
                const commentsRes = await GitHubAPI.getFile(`news/article-comments-storage/${currentEditingArticleId}.json`);
                if (commentsRes) {
                    await GitHubAPI.request(`/contents/news/article-comments-storage/${currentEditingArticleId}.json`, 'DELETE', {
                        message: `Delete comments for article: ${currentEditingArticleId}`,
                        sha: commentsRes.sha
                    });
                }
            } catch (e) {
                // Comments might not exist, ignore
            }

            // Update user contributions count
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

            settingsModal.classList.add('hidden');
            window.location.hash = ''; // Go back to feed
            loadArticles();
            alert('Article deleted successfully.');
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

        // Process line by line for block-level elements
        let lines = formatted.split('\n');
        let processedLines = lines.map(line => {
            // Headers: # Big Text
            if (line.startsWith('# ')) {
                return `<h1>${line.substring(2)}</h1>`;
            }
            // Quotes: > Quote
            if (line.startsWith('&gt; ')) {
                return `<blockquote>${line.substring(5)}</blockquote>`;
            }
            return line;
        });

        formatted = processedLines.join('\n');

        // Inline elements
        // Bold: **Text**
        formatted = formatted.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        
        // Italic: *Text*
        formatted = formatted.replace(/\*(.*?)\*/g, '<em>$1</em>');
        
        // Custom Colors: /color text
        const colors = ['red', 'blue', 'violet', 'yellow', 'green'];
        colors.forEach(color => {
            const regex = new RegExp(`/${color} (.*?)(?=\\s/|\\s$|$)`, 'g');
            formatted = formatted.replace(regex, `<span class="text-${color}">$1</span>`);
        });

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

        card.innerHTML = `
            <div class="article-banner" style="background-image: url(${article.banner || 'https://via.placeholder.com/400x150'})"></div>
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
                        <button class="comment-trigger-btn" data-article-id="${article.id}">💬 Comments</button>
                    </div>
                </div>
            </div>
        `;

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
        const btn = container.querySelector(`.reaction-btn[data-emoji="${emoji}"]`);
        const countSpan = btn.querySelector('.count');
        
        // Get current state from cache
        const article = articleData[articleId];
        if (!article) return; // Safety check

        if (!article.reactions) article.reactions = {};
        if (!article.reactions[emoji]) article.reactions[emoji] = [];
        
        const userIndex = article.reactions[emoji].indexOf(user.id);
        const isRemoving = userIndex > -1;

        // Update local state immediately
        if (isRemoving) {
            article.reactions[emoji].splice(userIndex, 1);
            btn.classList.remove('active');
        } else {
            article.reactions[emoji].push(user.id);
            btn.classList.add('active');
        }
        
        // Update UI immediately
        countSpan.textContent = article.reactions[emoji].length;
        // -----------------------------

        // Use the new queuedWrite to handle persistence in the background
        GitHubAPI.queuedWrite(`news/created-articles-storage/${articleId}.json`, async () => {
            try {
                // Fetch latest data to ensure we have the absolute latest state before pushing
                const data = await GitHubAPI.getFile(`news/created-articles-storage/${articleId}.json`);
                const latestArticle = JSON.parse(data.content);
                
                if (!latestArticle.reactions) latestArticle.reactions = {};
                if (!latestArticle.reactions[emoji]) latestArticle.reactions[emoji] = [];
                
                const latestUserIndex = latestArticle.reactions[emoji].indexOf(user.id);
                
                // Synchronize our optimistic change with the latest server state
                if (isRemoving) {
                    if (latestUserIndex > -1) latestArticle.reactions[emoji].splice(latestUserIndex, 1);
                } else {
                    if (latestUserIndex === -1) latestArticle.reactions[emoji].push(user.id);
                }

                const res = await GitHubAPI.updateFile(
                    `news/created-articles-storage/${articleId}.json`,
                    JSON.stringify(latestArticle),
                    `${isRemoving ? 'Remove' : 'Add'} reaction ${emoji}`,
                    data.sha
                );

                // Update our local cache with the final result from the server
                articleData[articleId] = latestArticle;
                articleSHAs[articleId] = res.content.sha;

                // Send notification if adding a reaction
                if (!isRemoving) {
                    addNotification(latestArticle.authorId, 'reaction', {
                        articleId: latestArticle.id,
                        articleTitle: latestArticle.title
                    });
                }
                
            } catch (e) {
                console.error('Background reaction update failed:', e);
                // Roll back UI if it fails permanently
                updateReactionUI(articleData[articleId]);
            }
        });
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
            console.error('Polling failed:', e);
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
            <button class="comment-trigger-btn" data-article-id="${article.id}">💬 Comments</button>
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

        container.querySelector('.comment-trigger-btn').addEventListener('click', () => openComments(article.id, article.title));

        container.querySelectorAll('.reaction-btn:not(.add-reaction)').forEach(btn => {
            btn.addEventListener('click', () => handleReaction(article.id, btn.dataset.emoji));
        });
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
            const joinDate = joinDateStr ? new Date(joinDateStr).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : 'Unknown';

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
                            ${author.statusMsg ? `<div class="profile-card-status-bubble">${author.statusMsg}</div>` : ''}
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
        document.getElementById('comments-title').innerText = `Comments: ${title}`;
        commentsModal.classList.remove('hidden');
        commentsList.innerHTML = '<p class="status-msg">Loading comments...</p>';
        
        try {
            const data = await GitHubAPI.getFile(`news/article-comments-storage/${articleId}.json`);
            if (data) {
                commentsSHA = data.sha;
                const comments = JSON.parse(data.content);
                renderComments(comments);
            } else {
                commentsSHA = null;
                commentsList.innerHTML = '<p class="status-msg">No comments yet. Be the first to say something!</p>';
            }
        } catch (e) {
            commentsSHA = null;
            commentsList.innerHTML = '<p class="status-msg">No comments yet. Be the first to say something!</p>';
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

        // User Mentions: @username
        formatted = formatted.replace(/@([a-zA-Z0-9_]+)/g, '<span class="mention" onclick="findAndShowUser(\'$1\')">@$1</span>');

        return formatted.replace(/\n/g, '<br>');
    }

    window.findAndShowUser = async function(username) {
        // This is a bit expensive, but we need to find the ID by username
        try {
            const files = await GitHubAPI.listFiles('news/created-news-accounts-storage');
            for (const file of files) {
                if (!file.name.endsWith('.json')) continue;
                const data = await GitHubAPI.getFile(file.path);
                const account = JSON.parse(data.content);
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
            const userUpvoted = user && c.votes && c.votes.up && c.votes.up.includes(user.id);
            const userDownvoted = user && c.votes && c.votes.down && c.votes.down.includes(user.id);
            const isCommentOwner = user && c.authorId === user.id;

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
                                <div class="comment-author-row">
                                    <span class="comment-author-name" onclick="window.showAuthorProfile('${c.authorId}')">${c.authorName}</span>
                                    <div class="comment-status-bubble" data-user-id="${c.authorId}" style="display: none;"></div>
                                </div>
                                <span class="comment-timestamp">${new Date(c.timestamp).toLocaleString()}</span>
                            </div>
                        </div>
                        <div class="comment-body">
                            ${formatCommentText(c.text)}
                            ${c.attachment ? `
                                <div class="comment-attachment">
                                    <img src="${c.attachment}" alt="Attachment" onclick="window.open('${c.attachment}', '_blank')">
                                </div>
                            ` : ''}
                        </div>
                        <div class="comment-actions">
                            <div class="comment-votes">
                                <button class="vote-btn upvote ${userUpvoted ? 'upvoted' : ''}" onclick="handleCommentVote('${c.id}', 'up')">
                                    ▲ <span class="vote-count">${upvotes}</span>
                                </button>
                                <button class="vote-btn downvote ${userDownvoted ? 'downvoted' : ''}" onclick="handleCommentVote('${c.id}', 'down')">
                                    ▼ <span class="vote-count">${downvotes}</span>
                                </button>
                            </div>
                            <span class="action-link" onclick="setupReply('${c.id}', '${c.authorName}')">Reply</span>
                            ${isArticleAuthor ? `
                                <span class="action-link pin-btn ${c.pinned ? 'active' : ''}" onclick="togglePinComment('${c.id}')">
                                    ${c.pinned ? 'Unpin' : 'Pin'}
                                </span>
                            ` : ''}
                            ${(isArticleAuthor || isCommentOwner) ? `
                                <span class="action-link delete-comment-btn" onclick="handleDeleteComment('${c.id}')">Delete</span>
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

         // Optimistically hide the comment
         const commentEl = document.getElementById(`comment-${commentId}`);
         if (commentEl) {
             const thread = commentEl.closest('.comment-thread');
             if (thread) thread.style.display = 'none';
         }

         GitHubAPI.queuedWrite(`news/article-comments-storage/${currentArticleIdForComments}.json`, async () => {
             try {
                 const data = await GitHubAPI.getFile(`news/article-comments-storage/${currentArticleIdForComments}.json`);
                 if (!data) return;
                 
                 let comments = JSON.parse(data.content);
                 const index = comments.findIndex(c => c.id === commentId);
                 if (index === -1) return;
                 
                 const commentToDelete = comments[index];
                 const article = articleData[currentArticleIdForComments];
                 const isArticleAuthor = user && article && article.authorId === user.id;
                 const isCommentOwner = user && commentToDelete.authorId === user.id;

                 if (!isArticleAuthor && !isCommentOwner) {
                     throw new Error('You do not have permission to delete this comment.');
                 }

                 // Remove the comment and all its replies
                 comments = comments.filter(c => c.id !== commentId && c.replyToId !== commentId);
                 
                 await GitHubAPI.updateFile(
                     `news/article-comments-storage/${currentArticleIdForComments}.json`,
                     JSON.stringify(comments),
                     `Delete comment ${commentId}`,
                     data.sha
                 );
                 
                 renderComments(comments);
             } catch (e) {
                 console.error('Delete comment failed:', e);
                 alert('Failed to delete comment: ' + e.message);
                 // Rollback optimistic hide
                 if (commentEl) {
                     const thread = commentEl.closest('.comment-thread');
                     if (thread) thread.style.display = 'block';
                 }
             }
         });
     };

     window.cancelReply = function() {
          currentReplyToId = null;
          const info = document.querySelector('.replying-to-info');
          if (info) info.remove();
      };

    window.togglePinComment = async function(commentId) {
        GitHubAPI.queuedWrite(`news/article-comments-storage/${currentArticleIdForComments}.json`, async () => {
            try {
                const data = await GitHubAPI.getFile(`news/article-comments-storage/${currentArticleIdForComments}.json`);
                if (!data) return;
                
                let comments = JSON.parse(data.content);
                const comment = comments.find(c => c.id === commentId);
                if (!comment) return;
                
                // Unpin others if we are pinning this one
                const isCurrentlyPinned = comment.pinned;
                if (!isCurrentlyPinned) {
                    comments.forEach(c => c.pinned = false);
                }
                
                comment.pinned = !isCurrentlyPinned;
                
                const res = await GitHubAPI.updateFile(
                    `news/article-comments-storage/${currentArticleIdForComments}.json`,
                    JSON.stringify(comments),
                    `${comment.pinned ? 'Pin' : 'Unpin'} comment ${commentId}`,
                    data.sha
                );
                
                // Send notification if pinning
                if (comment.pinned) {
                    const article = articleData[currentArticleIdForComments];
                    addNotification(comment.authorId, 'pin', {
                        articleId: article.id,
                        articleTitle: article.title,
                        commentId: comment.id
                    });
                }

                renderComments(comments);
            } catch (e) {
                alert('Failed to pin comment: ' + e.message);
            }
        });
    };

    window.handleCommentVote = async function(commentId, type) {
        if (!user) return alert('You must be logged in to vote');
        
        GitHubAPI.queuedWrite(`news/article-comments-storage/${currentArticleIdForComments}.json`, async () => {
            try {
                const data = await GitHubAPI.getFile(`news/article-comments-storage/${currentArticleIdForComments}.json`);
                if (!data) return;
                
                let comments = JSON.parse(data.content);
                const comment = comments.find(c => c.id === commentId);
                if (!comment) return;
                
                if (!comment.votes) comment.votes = { up: [], down: [] };
                if (!comment.votes.up) comment.votes.up = [];
                if (!comment.votes.down) comment.votes.down = [];

                const upIndex = comment.votes.up.indexOf(user.id);
                const downIndex = comment.votes.down.indexOf(user.id);

                if (type === 'up') {
                    if (upIndex > -1) {
                        comment.votes.up.splice(upIndex, 1);
                    } else {
                        comment.votes.up.push(user.id);
                        if (downIndex > -1) comment.votes.down.splice(downIndex, 1);
                    }
                } else if (type === 'down') {
                    if (downIndex > -1) {
                        comment.votes.down.splice(downIndex, 1);
                    } else {
                        comment.votes.down.push(user.id);
                        if (upIndex > -1) comment.votes.up.splice(upIndex, 1);
                    }
                }

                await GitHubAPI.updateFile(
                    `news/article-comments-storage/${currentArticleIdForComments}.json`,
                    JSON.stringify(comments),
                    `Vote ${type} on comment ${commentId}`,
                    data.sha
                );
                
                renderComments(comments);
            } catch (e) {
                console.error('Vote failed:', e);
            }
        });
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

        // Use queuedWrite to handle persistence in the background
        GitHubAPI.queuedWrite(`news/article-comments-storage/${currentArticleIdForComments}.json`, async () => {
            try {
                let comments = [];
                let sha = null;
                try {
                    const data = await GitHubAPI.getFile(`news/article-comments-storage/${currentArticleIdForComments}.json`);
                    if (data) {
                        comments = JSON.parse(data.content);
                        sha = data.sha;
                    }
                } catch (e) {}

                // Add the comment to the list
                comments.push(newComment);

                const res = await GitHubAPI.updateFile(
                    `news/article-comments-storage/${currentArticleIdForComments}.json`,
                    JSON.stringify(comments),
                    `New comment on article ${currentArticleIdForComments}`,
                    sha
                );

                // Update UI with the final state
                commentsSHA = res.content.sha;
                renderComments(comments);

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
                        const parentComment = comments.find(c => c.id === savedReplyToId);
                        if (parentComment) {
                            addNotification(parentComment.authorId, 'reply', {
                                articleId: currentArticle.id,
                                articleTitle: currentArticle.title,
                                commentId: newComment.id
                            });
                        }
                    }

                    // 3. Notify mentioned users
                    const mentions = savedText.match(/@([a-zA-Z0-9_]+)/g);
                    if (mentions) {
                        const uniqueMentions = [...new Set(mentions.map(m => m.substring(1)))];
                        for (const username of uniqueMentions) {
                            try {
                                const files = await GitHubAPI.listFiles('news/created-news-accounts-storage');
                                for (const file of files) {
                                    if (!file.name.endsWith('.json')) continue;
                                    const accData = await GitHubAPI.getFile(file.path);
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
                            } catch (e) {}
                        }
                    }
                }
            } catch (e) {
                console.error('Comment submission failed:', e);
                alert('Failed to post comment. Your text has been restored.');
                commentInput.value = savedText;
                // Re-setup attachment if it existed
                if (savedAttachment) {
                    currentAttachmentBase64 = savedAttachment;
                    attachmentPreview.querySelector('img').src = savedAttachment;
                    attachmentPreview.style.display = 'block';
                }
            } finally {
                btnSubmitComment.disabled = false;
                btnSubmitComment.innerText = 'Post';
            }
        });
    });
});
