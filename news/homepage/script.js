document.addEventListener('DOMContentLoaded', async () => {
    const user = JSON.parse(localStorage.getItem('current_user'));
    if (!user) {
        window.location.href = '../index.html';
        return;
    }

    // Update sidebar and header
    document.getElementById('side-pfp').src = user.pfp;
    document.getElementById('side-username').innerText = user.username;
    
    document.getElementById('header-pfp').src = user.pfp;
    document.getElementById('header-username').innerText = user.username;
    document.getElementById('header-id').innerText = `@${user.id || user.username.toLowerCase().replace(/\s+/g, '')}`;
    
    document.getElementById('welcome-title').innerText = `Welcome back, ${user.username}!`;

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
                    document.getElementById('header-pfp').src = remoteUser.pfp;
                    document.getElementById('header-username').innerText = remoteUser.username;
                    document.getElementById('welcome-title').innerText = `Welcome back, ${remoteUser.username}!`;
                    
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
        for (const file of sortedFiles) {
            const data = await GitHubAPI.getFile(file.path);
            const article = JSON.parse(data.content);
            
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
        }
    } catch (e) {
        console.error('Failed to load recent articles:', e);
        recentList.innerHTML = '<p class="error">Couldn\'t load latest updates.</p>';
    }
});
