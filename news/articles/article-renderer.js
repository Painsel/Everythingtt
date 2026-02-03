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
    
    let currentArticleIdForComments = null;
    let commentsSHA = null;

    const REACTION_EMOJIS = ["🔥", "✨", "👍", "🎉", "🤣", "😂", "😃", "🤔", "🥵", "🥶", "🤡", "🤖", "💀"];
    let articleSHAs = {}; // Store SHAs for updates
    let articleData = {}; // Store local data for polling comparisons

    // Show logged in user in sidebar if exists
    const user = JSON.parse(localStorage.getItem('current_user'));
    if (user) {
        const loggedInDiv = document.getElementById('logged-in-user');
        loggedInDiv.classList.remove('hidden');
        document.getElementById('side-pfp').src = user.pfp;
        document.getElementById('side-username').innerText = user.username;
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

                const validArticles = articles.filter(a => a !== null).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
                
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
            }
        } catch (e) {
            articlesList.innerHTML = `<p>Error loading articles: ${e.message}. Make sure you have set your PAT in the Dashboard.</p>`;
        }
    }

    // Initial load
    loadArticles();

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
        
        // Track user's own reactions locally (in real app, this would be in the article data)
        const userReactions = JSON.parse(localStorage.getItem(`reactions_${article.id}`) || '[]');

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
                            .filter(([emoji, count]) => count > 0)
                            .map(([emoji, count]) => `
                                <button class="reaction-btn ${userReactions.includes(emoji) ? 'active' : ''}" data-emoji="${emoji}" data-article-id="${article.id}">
                                    <span class="emoji">${emoji}</span>
                                    <span class="count">${count}</span>
                                </button>
                            `).join('')}
                        <button class="reaction-btn add-reaction" data-article-id="${article.id}">+</button>
                        <button class="comment-trigger-btn" data-article-id="${article.id}">💬 Comments</button>
                    </div>
                </div>
            </div>
        `;

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
        const userReactions = JSON.parse(localStorage.getItem(`reactions_${articleId}`) || '[]');
        const isRemoving = userReactions.includes(emoji);
        
        // Disable buttons for this article during update
        const container = document.querySelector(`#article-${articleId} .reactions-container`);
        const buttons = container.querySelectorAll('.reaction-btn');
        buttons.forEach(b => b.disabled = true);

        try {
            // Fetch latest data to ensure SHA is fresh
            const data = await GitHubAPI.getFile(`news/created-articles-storage/${articleId}.json`);
            const article = JSON.parse(data.content);
            
            if (!article.reactions) article.reactions = {};
            
            if (isRemoving) {
                article.reactions[emoji] = Math.max(0, (article.reactions[emoji] || 1) - 1);
                const index = userReactions.indexOf(emoji);
                userReactions.splice(index, 1);
            } else {
                article.reactions[emoji] = (article.reactions[emoji] || 0) + 1;
                userReactions.push(emoji);
            }

            const res = await GitHubAPI.updateFile(
                `news/created-articles-storage/${articleId}.json`,
                JSON.stringify(article),
                `${isRemoving ? 'Remove' : 'Add'} reaction ${emoji}`,
                data.sha
            );

            // Update local state
            localStorage.setItem(`reactions_${articleId}`, JSON.stringify(userReactions));
            articleSHAs[articleId] = res.content.sha;
            articleData[articleId] = article;
            
            // Re-render the reaction section
            updateReactionUI(article);

        } catch (e) {
            console.error('Reaction update failed:', e);
            alert('Failed to update reaction: ' + e.message);
        } finally {
            buttons.forEach(b => b.disabled = false);
        }
    }

    async function pollReactions() {
        try {
            const files = await GitHubAPI.listFiles('news/created-articles-storage');
            for (const file of files) {
                // If SHA changed, fetch new data
                const articleId = file.name.replace('.json', '');
                if (file.sha !== articleSHAs[articleId]) {
                    const data = await GitHubAPI.getFile(file.path);
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
        const userReactions = JSON.parse(localStorage.getItem(`reactions_${article.id}`) || '[]');
        
        const html = `
            ${Object.entries(article.reactions)
                .filter(([emoji, count]) => count > 0)
                .map(([emoji, count]) => `
                    <button class="reaction-btn ${userReactions.includes(emoji) ? 'active' : ''}" data-emoji="${emoji}" data-article-id="${article.id}">
                        <span class="emoji">${emoji}</span>
                        <span class="count">${count}</span>
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

            modalContent.innerHTML = `
                <div class="banner" style="background: ${author.banner.startsWith('#') ? author.banner : `url(${author.banner})`}"></div>
                <div class="profile-header">
                    <img class="pfp" src="${author.pfp}" alt="PFP">
                    <div class="profile-names">
                        <h4>${author.username}</h4>
                        <small>ID: ${author.id}</small>
                    </div>
                </div>
                <p class="bio">${author.bio}</p>
            `;
            profileModal.classList.remove('hidden');
        } catch (e) {
            alert('Error loading profile: ' + e.message);
        }
    }

    // Close modals
    if (closeModal) closeModal.onclick = () => profileModal.classList.add('hidden');
    if (closeCommentsModal) closeCommentsModal.onclick = () => commentsModal.classList.add('hidden');
    window.onclick = (event) => {
        if (profileModal && event.target == profileModal) profileModal.classList.add('hidden');
        if (commentsModal && event.target == commentsModal) commentsModal.classList.add('hidden');
    };

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

    function renderComments(comments) {
        if (!comments || comments.length === 0) {
            commentsList.innerHTML = '<p class="status-msg">No comments yet. Be the first to say something!</p>';
            return;
        }

        commentsList.innerHTML = comments.map(c => `
            <div class="comment-item">
                <div class="comment-header" onclick="window.showAuthorProfile('${c.authorId}')">
                    <img src="${c.authorPfp}" alt="${c.authorName}" class="comment-pfp">
                    <div class="comment-author-info">
                        <span class="comment-author-name">${c.authorName}</span>
                        <span class="comment-timestamp">${new Date(c.timestamp).toLocaleString()}</span>
                    </div>
                </div>
                <div class="comment-body">${c.text.replace(/\n/g, '<br>')}</div>
            </div>
        `).join('');
    }

    btnSubmitComment.addEventListener('click', async () => {
        const text = commentInput.value.trim();
        if (!text) return;
        if (!user) return alert('You must be logged in to comment');

        btnSubmitComment.disabled = true;
        btnSubmitComment.innerText = 'Posting...';

        try {
            let comments = [];
            try {
                const data = await GitHubAPI.getFile(`news/article-comments-storage/${currentArticleIdForComments}.json`);
                if (data) {
                    comments = JSON.parse(data.content);
                    commentsSHA = data.sha;
                }
            } catch (e) {
                // Folder or file might not exist yet
            }

            const newComment = {
                id: GitHubAPI.generateID().toString(),
                authorId: user.id,
                authorName: user.username,
                authorPfp: user.pfp,
                text: text,
                timestamp: new Date().toISOString()
            };

            comments.push(newComment);

            const res = await GitHubAPI.updateFile(
                `news/article-comments-storage/${currentArticleIdForComments}.json`,
                JSON.stringify(comments),
                `New comment on article ${currentArticleIdForComments}`,
                commentsSHA
            );

            commentsSHA = res.content.sha;
            commentInput.value = '';
            renderComments(comments);
        } catch (e) {
            alert('Failed to post comment: ' + e.message);
        } finally {
            btnSubmitComment.disabled = false;
            btnSubmitComment.innerText = 'Post';
        }
    });
});
