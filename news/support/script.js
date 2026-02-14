document.addEventListener('DOMContentLoaded', async () => {
    const GitHubAPI = window.GitHubAPI;
    let user = JSON.parse(localStorage.getItem('current_user'));
    if (!user) {
        window.location.href = '../index.html';
        return;
    }

    // Server-side check: Verify user still exists in storage
    if (!user.isGuest) {
        try {
            GitHubAPI.showPauseModal('Verifying account status...');
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
    } else {
        GitHubAPI.hidePauseModal();
    }

    // Update UI
    document.getElementById('display-name').innerText = user.username;
    
    // Update sidebar and header (standard shared logic)
    const updateUIWithStatus = (u) => {
        const isGuest = u.isGuest === true;
        const statusIconName = isGuest ? 'Offline.png' : ((u.statusType === 'dnd') ? 'DoNotDisturb.png' : (u.status === 'idle' ? 'Idle.png' : (u.status === 'online' ? 'Online.png' : 'Offline.png')));
        const iconPath = GitHubAPI.getStatusIconPath(statusIconName);

        document.getElementById('side-pfp').src = u.pfp;
        document.getElementById('side-username').innerText = u.username;

        // Update ETT Coins display
        const ettCoinsCount = document.getElementById('ett-coins-count');
        if (ettCoinsCount) {
            ettCoinsCount.innerText = (u.ettCoins || 0).toLocaleString();
        }
        document.getElementById('side-status-icon').style.backgroundImage = `url('${iconPath}')`;
        
        const sideBubble = document.getElementById('side-status-bubble');
        if (u.statusMsg) {
            sideBubble.innerText = u.statusMsg;
            sideBubble.style.display = 'block';
        } else {
            sideBubble.style.display = 'none';
        }

        // Show Admin link if user is admin or developer
        const isDeveloper = u && String(u.id) === String(GitHubAPI.DEVELOPER_ID);
        if (u.role === 'admin' || u.role === 'owner' || isDeveloper) {
            document.getElementById('admin-nav-item').classList.remove('hidden');
        }
    };

    updateUIWithStatus(user);

    // Sidebar Toggle
    const sidebar = document.querySelector('.sidebar');
    const sidebarToggle = document.getElementById('sidebar-toggle');
    
    sidebarToggle.addEventListener('click', () => {
        sidebar.classList.toggle('collapsed');
    });

    // Logout logic
    document.getElementById('btn-logout').addEventListener('click', () => {
        localStorage.removeItem('current_user');
        GitHubAPI.hidePauseModal();
        window.location.href = '../index.html';
    });
});
