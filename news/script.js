document.addEventListener('DOMContentLoaded', () => {
    const authContainer = document.getElementById('auth-container');
    const dashboardContainer = document.getElementById('dashboard-container');
    const btnLogin = document.getElementById('btn-login');
    const btnLogout = document.getElementById('btn-logout');
    const btnSaveProfile = document.getElementById('btn-save-profile');

    let currentUser = null;
    let userSha = null;

    // Load session if exists
    const savedUser = localStorage.getItem('current_user');
    if (savedUser) {
        window.location.href = 'homepage/';
        return;
    }

    const loginForm = document.getElementById('login-form');

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = document.getElementById('login-username').value;
        const password = document.getElementById('login-password').value;

        if (!username || !password) return alert('Username and Password required');

        try {
            btnLogin.disabled = true;
            btnLogin.innerText = 'Connecting...';

            // Check if user exists
            const files = await GitHubAPI.listFiles('news/created-news-accounts-storage');
            let foundUser = null;

            if (files.length > 0) {
                btnLogin.innerText = 'Searching...';
                for (const file of files) {
                    if (file.type !== 'file' || !file.name.endsWith('.json')) continue;
                    
                    // Use getFileRaw for high-speed searching
                    const content = await GitHubAPI.getFileRaw(file.path);
                    if (!content) continue;
                    
                    let user;
                    try {
                        user = JSON.parse(content);
                    } catch (e) {
                        console.warn(`Skipping invalid JSON file: ${file.path}`);
                        continue;
                    }

                    if (user.username === username) {
                        if (user.password === password) {
                            foundUser = user;
                            // We still need the SHA for the actual login sync later, so fetch it now
                            const data = await GitHubAPI.getFile(file.path);
                            userSha = data.sha;
                            break;
                        } else {
                            btnLogin.disabled = false;
                            btnLogin.innerText = 'Login / Sign Up';
                            return alert('Incorrect password');
                        }
                    }
                }
            }

            if (!foundUser) {
                btnLogin.innerText = 'Creating Account...';
                // Create new user
                const newUser = {
                    id: GitHubAPI.generateID().toString(),
                    username,
                    password,
                    pfp: 'https://via.placeholder.com/150',
                    banner: '#7289da',
                    bio: 'Welcome to my profile!',
                    joinDate: new Date().toISOString(),
                    contributions: 0
                };
                const res = await GitHubAPI.updateFile(`news/created-news-accounts-storage/${newUser.id}.json`, JSON.stringify(newUser), `Create user ${username}`);
                userSha = res.content.sha; // Capture SHA for future updates
                foundUser = newUser;
            } else {
                // For existing users, update joinDate and contributions if needed
                btnLogin.innerText = 'Syncing Profile...';
                let needsUpdate = false;
                
                // Ensure contributions is a number
                if (foundUser.contributions === undefined) {
                    foundUser.contributions = 0;
                    needsUpdate = true;
                }

                // Recalculate contributions
                const articles = await GitHubAPI.listFiles('news/created-articles-storage');
                let count = 0;
                for (const file of articles) {
                    if (file.name.endsWith('.json')) {
                        // Use getFileRaw for speed
                        const content = await GitHubAPI.getFileRaw(file.path);
                        if (content) {
                            try {
                                const article = JSON.parse(content);
                                if (article.authorId === foundUser.id) {
                                    count++;
                                }
                            } catch(e) {}
                        }
                    }
                }
                
                if (foundUser.contributions !== count) {
                    foundUser.contributions = count;
                    needsUpdate = true;
                }

                if (needsUpdate) {
                    const res = await GitHubAPI.updateFile(
                        `news/created-news-accounts-storage/${foundUser.id}.json`,
                        JSON.stringify(foundUser),
                        `Update account metadata for ${foundUser.username}`,
                        userSha
                    );
                    userSha = res.content.sha;
                }
            }

            showDashboard(foundUser);
            window.location.href = 'homepage/';
        } catch (e) {
            console.error('Auth Error:', e);
            alert('Error: ' + e.message);
        } finally {
            btnLogin.disabled = false;
            btnLogin.innerText = 'Login / Sign Up';
        }
    });

    btnLogout.addEventListener('click', () => {
        localStorage.removeItem('current_user');
        localStorage.removeItem('gh_pat');
        location.reload();
    });

    btnSaveProfile.addEventListener('click', async () => {
        const pfp = document.getElementById('edit-pfp').value;
        const banner = document.getElementById('edit-banner').value;
        const username = document.getElementById('edit-username').value;
        const bio = document.getElementById('edit-bio').value;

        currentUser.pfp = pfp;
        currentUser.banner = banner;
        currentUser.username = username;
        currentUser.bio = bio;

        try {
            const res = await GitHubAPI.updateFile(`news/created-news-accounts-storage/${currentUser.id}.json`, JSON.stringify(currentUser), `Update profile ${currentUser.username}`, userSha);
            userSha = res.content.sha;
            showDashboard(currentUser);
            alert('Profile saved!');
        } catch (e) {
            alert('Error saving profile: ' + e.message);
        }
    });

    function showDashboard(user) {
        currentUser = user;
        user.sha = userSha; // Ensure SHA is stored for status exit tracking
        localStorage.setItem('current_user', JSON.stringify(user));
        authContainer.classList.add('hidden');
        dashboardContainer.classList.remove('hidden');

        document.getElementById('welcome-msg').innerText = `Hello ${user.username}, welcome to EverythingTT's News Dashboard. Please read our guidelines before you can publish your news.`;
        document.getElementById('side-username').innerText = user.username;
        document.getElementById('side-pfp').src = user.pfp;

        // Profile Display
        document.getElementById('profile-pfp').src = user.pfp;
        document.getElementById('profile-banner').style.background = user.banner.startsWith('#') ? user.banner : `url(${user.banner})`;
        document.getElementById('profile-username-display').innerText = user.username;
        document.getElementById('profile-id-display').innerText = `ID: ${user.id}`;
        document.getElementById('profile-bio-display').innerText = user.bio;
        
        // Badges
        const badgeContainerId = 'dashboard-badge-container';
        let badgeContainer = document.getElementById(badgeContainerId);
        if (!badgeContainer) {
            badgeContainer = document.createElement('div');
            badgeContainer.id = badgeContainerId;
            badgeContainer.style.display = 'inline-flex';
            badgeContainer.style.marginLeft = '8px';
            badgeContainer.style.verticalAlign = 'middle';
            document.getElementById('profile-username-display').appendChild(badgeContainer);
        }
        badgeContainer.innerHTML = GitHubAPI.renderNewUserBadge(user.joinDate);

        // Stats
        const joinDate = user.joinDate ? new Date(user.joinDate).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : 'Recently';
        document.getElementById('profile-contributions-display').innerText = `📚 ${user.contributions || 0} Articles`;
        document.getElementById('profile-join-display').innerText = `🗓️ Joined ${joinDate}`;

        // Editor Fields
        document.getElementById('edit-pfp').value = user.pfp;
        document.getElementById('edit-banner').value = user.banner;
        document.getElementById('edit-username').value = user.username;
        document.getElementById('edit-bio').value = user.bio;
    }
});
