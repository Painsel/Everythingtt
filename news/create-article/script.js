document.addEventListener('DOMContentLoaded', () => {
    const user = JSON.parse(localStorage.getItem('current_user'));
    if (!user) {
        window.location.href = '../';
        return;
    }

    document.getElementById('side-pfp').src = user.pfp;
    document.getElementById('side-username').innerText = user.username;

    let userSHA = null;
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
                    document.getElementById('side-pfp').src = remoteUser.pfp;
                    document.getElementById('side-username').innerText = remoteUser.username;
                    
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

    const titleInput = document.getElementById('article-title');
    const contentInput = document.getElementById('article-content');
    const titleCounter = document.getElementById('title-counter');
    const contentCounter = document.getElementById('content-counter');
    const btnPublish = document.getElementById('btn-publish');
    const bannerFileInput = document.getElementById('article-banner-file');
    const bannerPreviewContainer = document.getElementById('banner-preview-container');
    const bannerPreview = document.getElementById('banner-preview');
    const btnRemoveBanner = document.getElementById('btn-remove-banner');

    let currentBannerBase64 = '';

    const TITLE_LIMIT = 200;
    const CONTENT_LIMIT = 50000;

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

    // Banner handling
    bannerFileInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (file) {
            try {
                btnPublish.disabled = true;
                btnPublish.innerText = 'Processing Image...';
                
                // Allow larger banners for higher quality
                currentBannerBase64 = await optimizeImage(file, 1920, 1080);
                bannerPreview.src = currentBannerBase64;
                bannerPreviewContainer.classList.remove('hidden');
                
                updateCounters();
            } catch (err) {
                console.error('Banner processing failed:', err);
                alert('Failed to process image');
            } finally {
                btnPublish.innerText = 'Publish Article';
            }
        }
    });

    btnRemoveBanner.addEventListener('click', () => {
        currentBannerBase64 = '';
        bannerFileInput.value = '';
        bannerPreviewContainer.classList.add('hidden');
        bannerPreview.src = '';
    });

    // Removed the "double count" logic for format characters to allow more content
    function calculateCount(text) {
        if (!text) return 0;
        return text.length;
    }

    function updateCounters() {
        const titleCount = calculateCount(titleInput.value);
        const contentCount = calculateCount(contentInput.value);

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
        const banner = currentBannerBase64 || '#7289da'; // Fallback to default color if no banner
        const content = contentInput.value;

        const titleCount = calculateCount(title);
        const contentCount = calculateCount(content);

        if (titleCount > TITLE_LIMIT) return alert(`Title is too long (${titleCount}/${TITLE_LIMIT})`);
        if (contentCount > CONTENT_LIMIT) return alert(`Content is too long (${contentCount}/${CONTENT_LIMIT})`);
        if (!title || !content) return alert('Title and Content are required');

        const article = {
            id: GitHubAPI.generateID().toString(),
            title,
            banner,
            content,
            authorId: user.id,
            authorName: user.username,
            authorPfp: user.pfp,
            timestamp: new Date().toISOString(),
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
