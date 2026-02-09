import { GitHubAPI } from '../utils.js';

document.addEventListener('DOMContentLoaded', async () => {
    let user = JSON.parse(localStorage.getItem('current_user'));
    if (!user) {
        window.location.href = '../index.html';
        return;
    }

    // Server-side check: Verify user still exists in storage
    if (!user.isGuest) {
        try {
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
        }
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
        document.getElementById('side-status-icon').style.backgroundImage = `url('${iconPath}')`;
        
        const sideBubble = document.getElementById('side-status-bubble');
        if (u.statusMsg) {
            sideBubble.innerText = u.statusMsg;
            sideBubble.style.display = 'block';
        } else {
            sideBubble.style.display = 'none';
        }

        // Show Admin link if user is admin
        if (u.role === 'admin' || u.role === 'owner') {
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
        window.location.href = '../index.html';
    });
});
