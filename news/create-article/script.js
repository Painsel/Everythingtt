document.addEventListener('DOMContentLoaded', () => {
    const user = JSON.parse(localStorage.getItem('current_user'));
    if (!user || user.isGuest) {
        window.location.href = '../homepage/';
        return;
    }

    document.getElementById('side-pfp').src = user.pfp;
    document.getElementById('side-username').innerText = user.username;
    
    // Initial badge render
    const sideUsername = document.getElementById('side-username');
    let sideBadgeContainer = sideUsername.nextElementSibling;
    if (!sideBadgeContainer || !sideBadgeContainer.classList.contains('badge-container')) {
        sideBadgeContainer = document.createElement('div');
        sideBadgeContainer.className = 'badge-container';
        sideUsername.parentNode.insertBefore(sideBadgeContainer, sideUsername.nextSibling);
    }
    sideBadgeContainer.innerHTML = GitHubAPI.renderNewUserBadge(user.joinDate, 'user-badge side-badge');

    let userSHA = null;

    // Security check: IP Address restriction
    async function checkIP() {
        if (!user || user.isGuest) return;
        try {
            const currentIp = await GitHubAPI.getClientIP();
            if (currentIp && user.allowedIp && !GitHubAPI.compareIPs(user.allowedIp, currentIp)) {
                console.error('IP Mismatch detected. Logging out.');
                localStorage.removeItem('current_user');
                window.location.href = '../index.html?error=ip_mismatch';
            } else if (currentIp && user.allowedIp && user.allowedIp !== currentIp && GitHubAPI.compareIPs(user.allowedIp, currentIp)) {
                // Dynamic IP update during session
                console.log(`[Security] Dynamic IP shift detected: ${user.allowedIp} -> ${currentIp}`);
                user.allowedIp = currentIp;
                localStorage.setItem('current_user', JSON.stringify(user));
                
                // Update on server
                const data = await GitHubAPI.getFile(`news/created-news-accounts-storage/${user.id}.json`);
                if (data) {
                    const serverUser = JSON.parse(atob(data.content));
                    serverUser.allowedIp = currentIp;
                    await GitHubAPI.updateFile(
                        `news/created-news-accounts-storage/${user.id}.json`,
                        JSON.stringify(serverUser),
                        `Security: Session-based dynamic IP update for ${user.username}`,
                        data.sha
                    );
                }
            }
        } catch (e) {
            console.error('Failed to verify IP during session:', e);
        }
    }

    async function pollUserProfile() {
        if (!user || user.isGuest) return;
        await GitHubAPI.syncUserProfile((remoteUser) => {
            // Update local user reference properties
            Object.assign(user, remoteUser);
            
            // Update UI elements
            document.getElementById('side-pfp').src = remoteUser.pfp;
            document.getElementById('side-username').innerText = remoteUser.username;
            
            // Update badge
            if (sideBadgeContainer) {
                sideBadgeContainer.innerHTML = GitHubAPI.renderNewUserBadge(remoteUser.joinDate, 'user-badge side-badge');
            }
            
            console.log('Profile updated from remote');
        });
    }

    pollUserProfile(); // Initial check
    checkIP(); // Initial IP check
    setInterval(pollUserProfile, 30000); // Poll every 30s
    setInterval(checkIP, 60000); // Poll IP every 60s

    const titleInput = document.getElementById('article-title');
    const contentInput = document.getElementById('article-content');
    const titleCounter = document.getElementById('title-counter');
    const contentCounter = document.getElementById('content-counter');
    const btnPublish = document.getElementById('btn-publish');
    const markPrivateToggle = document.getElementById('mark-private-toggle');
    
    const bannerFileInput = document.getElementById('article-banner-file');
    const bannerPreviewContainer = document.getElementById('banner-preview-container');
    const slideshowPreview = document.getElementById('banner-slideshow-preview');
    const bannerCountText = document.getElementById('banner-count');
    const btnPrevBanner = document.getElementById('btn-prev-banner');
    const btnNextBanner = document.getElementById('btn-next-banner');
    const btnRemoveBanner = document.getElementById('btn-remove-banner');

    let currentBannersBase64 = [];
    let currentSlideshowIndex = 0;

    const TITLE_LIMIT = 50;
    const CONTENT_LIMIT = 3000;

    // Image optimization helper
    async function optimizeImage(file, maxWidth, maxHeight) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = new Image();
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    let width = img.width;
                    let height = img.height;

                    if (width > height) {
                        if (width > maxWidth) {
                            height *= maxWidth / width;
                            width = maxWidth;
                        }
                    } else {
                        if (height > maxHeight) {
                            width *= maxHeight / height;
                            height = maxHeight;
                        }
                    }

                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, width, height);
                    resolve(canvas.toDataURL('image/jpeg', 0.9)); // Higher quality
                };
                img.onerror = reject;
                img.src = e.target.result;
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }

    function updateSlideshowPreview() {
        slideshowPreview.innerHTML = '';
        if (currentBannersBase64.length === 0) {
            bannerPreviewContainer.classList.add('hidden');
            return;
        }

        currentBannersBase64.forEach((base64, index) => {
            const img = document.createElement('img');
            img.src = base64;
            if (index === currentSlideshowIndex) img.classList.add('active');
            slideshowPreview.appendChild(img);
        });

        bannerCountText.innerText = `${currentSlideshowIndex + 1} / ${currentBannersBase64.length}`;
        bannerPreviewContainer.classList.remove('hidden');
    }

    btnPrevBanner.addEventListener('click', () => {
        if (currentBannersBase64.length <= 1) return;
        currentSlideshowIndex = (currentSlideshowIndex - 1 + currentBannersBase64.length) % currentBannersBase64.length;
        updateSlideshowPreview();
    });

    btnNextBanner.addEventListener('click', () => {
        if (currentBannersBase64.length <= 1) return;
        currentSlideshowIndex = (currentSlideshowIndex + 1) % currentBannersBase64.length;
        updateSlideshowPreview();
    });

    // Banner handling
    bannerFileInput.addEventListener('change', async (e) => {
        let files = Array.from(e.target.files);
        if (files.length > 0) {
            const MAX_SIZE = 2 * 1024 * 1024; // 2 MB
            
            try {
                btnPublish.disabled = true;
                btnPublish.innerText = 'Processing Images...';
                
                const newBanners = [];
                for (const file of files) {
                    if (file.size > MAX_SIZE) {
                        alert(`Image "${file.name}" is too large (max 2MB)`);
                        continue;
                    }
                    if (file.type === 'image/gif') {
                        alert(`GIFs are not allowed: "${file.name}"`);
                        continue;
                    }
                    const base64 = await optimizeImage(file, 1920, 1080);
                    newBanners.push(base64);
                }

                if (newBanners.length > 0) {
                    currentBannersBase64 = [...currentBannersBase64, ...newBanners];
                    currentSlideshowIndex = currentBannersBase64.length - newBanners.length;
                    updateSlideshowPreview();
                }
            } catch (err) {
                console.error('Banner processing failed:', err);
                alert('Failed to process image');
            } finally {
                btnPublish.innerText = 'Publish Article';
                updateCounters();
            }
        }
    });

    btnRemoveBanner.addEventListener('click', () => {
        currentBannersBase64 = [];
        currentSlideshowIndex = 0;
        bannerFileInput.value = '';
        updateSlideshowPreview();
    });

    // Weighted count logic: Markdown counts for 2 characters per character
    function calculateCount(text, isContent = false) {
        if (!text) return 0;
        if (!isContent) return text.length;

        let weightedLength = text.length;
        
        // Define Markdown patterns that count double. 
        // We use a single regex with alternation to avoid double-counting overlapping matches.
        // The order matters: more specific/longer patterns should come first.
        const markdownRegex = /(!\[.*?\]\(.*?\)|\[.*?\]\(.*?\)|@\[.*?\]|@[a-zA-Z0-9_]+|\*\*+|#+\s|^>\s|^---$|\/(red|blue|violet|yellow|green)\s|^[-*]\s)/gm;

        const matches = text.match(markdownRegex);
        if (matches) {
            matches.forEach(match => {
                weightedLength += match.length;
            });
        }

        return weightedLength;
    }

    function updateCounters() {
        const titleCount = calculateCount(titleInput.value, false);
        const contentCount = calculateCount(contentInput.value, true);

        titleCounter.innerText = `${titleCount} / ${TITLE_LIMIT}`;
        contentCounter.innerText = `${contentCount} / ${CONTENT_LIMIT}`;

        if (titleCount > TITLE_LIMIT) {
            titleCounter.classList.add('limit-reached');
        } else {
            titleCounter.classList.remove('limit-reached');
        }

        if (contentCount > CONTENT_LIMIT) {
            contentCounter.classList.add('limit-reached');
        } else {
            contentCounter.classList.remove('limit-reached');
        }

        btnPublish.disabled = (titleCount > TITLE_LIMIT || contentCount > CONTENT_LIMIT || !titleInput.value || !contentInput.value);
    }

    titleInput.addEventListener('input', updateCounters);
    contentInput.addEventListener('input', updateCounters);

    btnPublish.addEventListener('click', async () => {
        const title = titleInput.value;
        const banner = currentBannersBase64.length > 0 ? currentBannersBase64 : ['#7289da']; // Store array of banners or fallback color
        const content = contentInput.value;

        const titleCount = calculateCount(title, false);
        const contentCount = calculateCount(content, true);

        if (titleCount > TITLE_LIMIT) return alert(`Title is too long (${titleCount}/${TITLE_LIMIT})`);
        if (contentCount > CONTENT_LIMIT) return alert(`Content is too long (${contentCount}/${CONTENT_LIMIT})`);
        if (!title || !content) return alert('Title and Content are required');

        // Check for rule violations
        const contentToCheck = `${title} ${content}`;
        const ruleCheck = await GitHubAPI.checkContentForRules(contentToCheck);
        
        if (!ruleCheck.isClean) {
            GitHubAPI.showRulesWarningModal(ruleCheck.violatedWords, '../');
            return;
        }

        const article = {
            id: GitHubAPI.generateID().toString(),
            title,
            banner,
            content,
            authorId: user.id,
            authorName: user.username,
            authorPfp: user.pfp,
            timestamp: new Date().toISOString(),
            isPrivate: !!markPrivateToggle.checked,
            reactions: {
                "🔥": 0, "✨": 0, "👍": 0, "🎉": 0, "🤣": 0, "😂": 0, "😃": 0, "🤔": 0, "🥵": 0, "🥶": 0, "🤡": 0, "🤖": 0, "💀": 0
            }
        };

        try {
            btnPublish.disabled = true;
            btnPublish.innerText = 'Publishing...';
            
            await GitHubAPI.updateFile(
                `news/created-articles-storage/${article.id}.json`, 
                JSON.stringify(article), 
                `Publish article: ${title}`
            );

            // Update user contributions
            try {
                const userData = await GitHubAPI.getFile(`news/created-news-accounts-storage/${user.id}.json`);
                if (userData) {
                    const profile = JSON.parse(userData.content);
                    profile.contributions = (profile.contributions || 0) + 1;
                    await GitHubAPI.updateFile(
                        `news/created-news-accounts-storage/${user.id}.json`,
                        JSON.stringify(profile),
                        `Increment contributions for ${user.username}`,
                        userData.sha
                    );
                    // Update local storage
                    localStorage.setItem('current_user', JSON.stringify(profile));
                }
            } catch (e) {
                console.warn('Failed to update contributions count:', e);
            }
            
            alert('Article published successfully!');
            window.location.href = '../articles/';
        } catch (e) {
            alert('Error publishing article: ' + e.message);
            btnPublish.disabled = false;
            btnPublish.innerText = 'Publish Article';
        }
    });
});
